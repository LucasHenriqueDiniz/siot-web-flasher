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
  write(data: string | Uint8Array): void;
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
      throw new Error("Serial port is not available");
    }
    return this.port.readable;
  }

  async sendSerialData(data: string): Promise<void> {
    if (!this.port?.writable) {
      throw new Error("Serial port is not available");
    }

    if (!this.writer) {
      this.writer = this.port.writable.getWriter();
    }

    const encoder = new TextEncoder();
    await this.writer.write(encoder.encode(data));
  }

  async eraseFlash(): Promise<void> {
    if (!this.espLoader) {
      throw new Error("Device not connected");
    }

    if (this.terminal) {
      this.terminal.writeLine("Erasing flash...");
    }

    await this.espLoader.eraseFlash();

    if (this.terminal) {
      this.terminal.writeLine("Flash erased successfully");
    }
  }

  async connect(baudRate = 115200): Promise<FlashResult> {
    try {
      if (this.terminal) {
        this.terminal.writeLine("Requesting access to serial port...");
      }

      // Request port without filters to show all devices
      this.port = await navigator.serial.requestPort({
        filters: [], // Empty array to show all devices
      });

      if (!this.port) {
        throw new Error("No serial port selected");
      }

      if (this.terminal) {
        this.terminal.writeLine("Port selected, opening connection...");
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
        this.terminal.writeLine("Connecting to ESP chip...");
      }

      // Connect to the device using the main method which handles the connection sequence
      const chipInfo = await this.espLoader.main();

      if (this.terminal) {
        this.terminal.writeLine(`Chip detected: ${chipInfo}`);
      }

      return { success: true, chipInfo };
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (this.terminal) {
        this.terminal.writeLine(`Connection error: ${errorMessage}`);
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
      onLog("Starting firmware flash...");

      // Download the firmware
      onLog(`Downloading firmware from: ${firmwareUrl}`);
      const response = await fetch(firmwareUrl);
      if (!response.ok) {
        throw new Error(`Error downloading firmware: ${response.statusText} (${response.status})`);
      }

      const firmwareData = await response.arrayBuffer();
      const firmwareBuffer = new Uint8Array(firmwareData);

      if (firmwareBuffer.length === 0) {
        throw new Error("Firmware empty or not found");
      }

      onLog(`Firmware size: ${firmwareBuffer.length} bytes`);

      if (!this.espLoader) {
        throw new Error("Device not connected");
      }

      // Convert binary data to the correct format
      const binaryString = Array.from(firmwareBuffer)
        .map((b) => String.fromCharCode(b))
        .join("");

      onLog(`Flash address: 0x${flashAddress.toString(16)}`);

      // Configure the flash exactly as in the working example
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
        flashMode: "dio", // Using dio instead of qio
        flashFreq: "40m", // Using lower frequency 40m instead of 80m
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const progress = Math.round((written / total) * 100);
          onProgress(progress);
          onLog(`Flash progress: ${progress}% (${written}/${total} bytes)`);
        },
      };

      onLog("Starting flash process...");
      // The writeFlash method is asynchronous, we need to wait until it completes
      await this.espLoader.writeFlash(flashOptions);
      onLog("Flash completed successfully!");

      // Reset the device
      onLog("Restarting device...");
      await this.espLoader.after();

      // Force a hard reset using RTS
      if (this.transport) {
        onLog("Performing device hard reset...");
        await this.transport.setDTR(false);
        await this.transport.setRTS(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await this.transport.setRTS(false);
        onLog("Reset complete");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      onLog(`Error during flash: ${errorMessage}`);
      console.error("Detailed error:", error);
      throw error;
    }
  }

  async flashAndTest(
    firmwareUrl: string,
    onProgress: (progress: number) => void,
    onLog: (message: string) => void,
    onData: (data: string) => void,
    flashAddress: number = 0x1000
  ): Promise<void> {
    try {
      onLog("🚀 Iniciando processo Flash + Test integrado...");

      // === FASE 1: FLASH DO FIRMWARE ===
      onLog("⚡ Instalando firmware...");
      await this.flashFirmware(firmwareUrl, onProgress, onLog, flashAddress);

      // === FASE 2: DESCONECTAR COMPLETAMENTE ===
      onLog("🔌 Desconectando após flash...");
      await this.disconnect();

      // === FASE 3: AGUARDAR E RECONECTAR PARA SERIAL ===
      onLog("⏳ Aguardando dispositivo estabilizar...");
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Reconnect using the same port for serial monitoring
      onLog("📡 Reconectando para monitoramento serial...");
      const connectResult = await this.connect(115200);
      if (!connectResult.success) {
        throw new Error(connectResult.error || "Falha na reconexão");
      }

      // Start serial monitoring using transport rawRead
      onLog("📖 Iniciando leitura serial...");
      this.startSerialMonitoring(onData, onLog);

      onLog("🎯 Flash + Test ativo - aguardando protocolo Echo...");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      onLog(`❌ Erro durante Flash + Test: ${errorMessage}`);
      throw error;
    }
  }

  private startSerialMonitoring(onData: (data: string) => void, onLog: (message: string) => void): void {
    if (!this.transport) {
      onLog("❌ Transport não disponível para leitura");
      return;
    }

    onLog("✅ Iniciando monitoramento serial...");

    // Use transport's rawRead method for console monitoring
    const readLoop = async () => {
      try {
        for await (const value of this.transport!.rawRead()) {
          if (value && value.length > 0) {
            const text = new TextDecoder().decode(value);
            if (text.trim()) {
              onData(text);
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          onLog(`❌ Erro na leitura serial: ${error.message}`);
        }
      }
    };

    // Start reading in background
    readLoop().catch((error) => {
      console.error("Erro no loop de leitura:", error);
    });
  }

  async sendCommand(command: string): Promise<void> {
    if (this.transport) {
      const encoder = new TextEncoder();
      const data = encoder.encode(command + "\r\n");
      await this.transport.write(data);
      return;
    }
    throw new Error("Transport não disponível para envio de comandos");
  }

  async reset(): Promise<void> {
    if (!this.transport) {
      throw new Error("Transport não disponível");
    }

    await this.transport.setDTR(false);
    await this.transport.setRTS(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await this.transport.setRTS(false);
  }

  isSerialReading(): boolean {
    return this.transport !== null;
  }

  async stopSerialReading(): Promise<void> {
    // For this simplified version, stopping means disconnecting
    await this.disconnect();
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
          console.warn("Error closing port:", error);
        }
        this.port = null;
      }

      this.espLoader = null;
      return true;
    } catch (error) {
      console.error("Error disconnecting:", error);
      return false;
    }
  }

  getTransport(): Transport | null {
    return this.transport;
  }
}

const flashServiceInstance = new FlashService();
export default flashServiceInstance;
