import { ESPLoader, ROM, Transport } from "esptool-js";

// Add Web Serial API types
declare global {
  interface Navigator {
    serial: {
      requestPort(options?: { filters: Array<{ usbVendorId: number; usbProductId: number }> }): Promise<SerialPort>;
    };
    usb?: {
      requestDevice(options: { filters: Array<{ vendorId: number; productId: number }> }): Promise<any>;
    };
  }

  interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream;
    writable: WritableStream;
  }

  interface Window {
    SerialPort: any;
    Serial: any;
  }
}

interface Terminal {
  clean(): void;
  writeLine(data: string): void;
  write(data: string): void;
}

interface FlashResult {
  success: boolean;
  error?: string;
  chipInfo?: string | ROM | null;
}

export class FlashService {
  private espLoader: ESPLoader | null = null;
  private port: SerialPort | null = null;
  private transport: Transport | null = null;
  private terminal: Terminal | null = null;
  private _traceLog: string[] = [];
  private reader: ReadableStreamDefaultReader | null = null;
  private writer: WritableStreamDefaultWriter | null = null;

  setTerminal(terminal: Terminal) {
    this.terminal = terminal;
  }

  getSerialStream(): ReadableStream {
    if (!this.port?.readable) {
      throw new Error("Porta serial não está disponível");
    }
    return this.port.readable;
  }

  async sendSerialData(data: string): Promise<void> {
    if (!this.port?.writable) {
      throw new Error("Porta serial não está disponível");
    }

    if (!this.writer) {
      this.writer = this.port.writable.getWriter();
    }

    const encoder = new TextEncoder();
    await this.writer.write(encoder.encode(data));
  }

  async eraseFlash(): Promise<void> {
    if (!this.espLoader) {
      throw new Error("Dispositivo não conectado");
    }

    if (this.terminal) {
      this.terminal.writeLine("Apagando flash...");
    }

    await this.espLoader.eraseFlash();

    if (this.terminal) {
      this.terminal.writeLine("Flash apagado com sucesso");
    }
  }

  async connect(baudRate = 115200): Promise<FlashResult> {
    try {
      if (this.terminal) {
        this.terminal.writeLine("Solicitando acesso à porta serial...");
      }

      // Request port without filters to show all devices
      this.port = await navigator.serial.requestPort({
        filters: [], // Empty array to show all devices
      });

      if (!this.port) {
        throw new Error("Nenhuma porta serial selecionada");
      }

      if (this.terminal) {
        this.terminal.writeLine("Porta selecionada, abrindo conexão...");
      }

      // Create transport instance first
      this.transport = new Transport(this.port, true);

      // Create ESPLoader instance
      this.espLoader = new ESPLoader({
        transport: this.transport,
        baudrate: baudRate,
        romBaudrate: baudRate,
        terminal: this.terminal || undefined,
      });

      if (this.terminal) {
        this.terminal.writeLine("Conectando ao chip ESP...");
      }

      // Connect to the device using the main method which handles the connection sequence
      const chipInfo = await this.espLoader.main();

      if (this.terminal) {
        this.terminal.writeLine(`Chip detectado: ${chipInfo}`);
      }

      return { success: true, chipInfo };
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (this.terminal) {
        this.terminal.writeLine(`Erro ao conectar: ${errorMessage}`);
      }
      // Clean up resources on error
      await this.disconnect();
      return { success: false, error: errorMessage };
    }
  }

  async flashFirmware(
    firmwareUrl: string,
    onProgress: (progress: number) => void,
    onLog: (message: string) => void,
    flashAddress: number = 0x1000
  ): Promise<void> {
    try {
      onLog("Iniciando flash do firmware...");

      // Baixar o firmware
      onLog(`Baixando firmware de: ${firmwareUrl}`);
      const response = await fetch(firmwareUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar firmware: ${response.statusText} (${response.status})`);
      }

      const firmwareData = await response.arrayBuffer();
      const firmwareBuffer = new Uint8Array(firmwareData);

      if (firmwareBuffer.length === 0) {
        throw new Error("Firmware vazio ou não encontrado");
      }

      onLog(`Tamanho do firmware: ${firmwareBuffer.length} bytes`);

      if (!this.espLoader) {
        throw new Error("Dispositivo não conectado");
      }

      // Converter dados binários para o formato correto
      const binaryString = Array.from(firmwareBuffer)
        .map((b) => String.fromCharCode(b))
        .join("");

      onLog(`Endereço de flash: 0x${flashAddress.toString(16)}`);

      // Configurar o flash exatamente como no exemplo que funciona
      const flashOptions = {
        fileArray: [
          {
            data: binaryString,
            address: flashAddress,
          },
        ],
        flashSize: "keep",
        eraseAll: false,
        compress: true,
        flashMode: "dio", // Tentando com dio em vez de qio
        flashFreq: "40m", // Tentando com frequência menor 40m em vez de 80m
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const progress = Math.round((written / total) * 100);
          onProgress(progress);
          onLog(`Progresso do flash: ${progress}% (${written}/${total} bytes)`);
        },
      };

      onLog("Iniciando processo de flash...");
      // O método writeFlash é assíncrono, precisamos esperar até que esteja concluído
      await this.espLoader.writeFlash(flashOptions);
      onLog("Flash concluído com sucesso!");

      // Resetar o dispositivo
      onLog("Reiniciando dispositivo...");
      await this.espLoader.after();

      // Force a hard reset using RTS
      if (this.transport) {
        onLog("Realizando hard reset do dispositivo...");
        await this.transport.setDTR(false);
        await this.transport.setRTS(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await this.transport.setRTS(false);
        onLog("Reset concluído");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      onLog(`Erro durante o flash: ${errorMessage}`);
      console.error("Erro detalhado:", error);
      throw error;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }

      if (this.writer) {
        await this.writer.close();
        this.writer.releaseLock();
        this.writer = null;
      }

      if (this.transport) {
        await this.transport.disconnect();
        this.transport = null;
      }

      if (this.port) {
        try {
          await this.port.close();
        } catch (error) {
          console.warn("Erro ao fechar porta:", error);
        }
        this.port = null;
      }

      this.espLoader = null;
      return true;
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      return false;
    }
  }

  getTransport(): Transport | null {
    return this.transport;
  }
}

const flashServiceInstance = new FlashService();
export default flashServiceInstance;
