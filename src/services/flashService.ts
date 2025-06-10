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

  setTerminal(terminal: Terminal) {
    this.terminal = terminal;
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

  async flashFirmware(firmwareData: Uint8Array, progressCallback: (progress: number) => void): Promise<FlashResult> {
    try {
      if (!this.espLoader) {
        throw new Error("Dispositivo não conectado");
      }

      const flashOptions = {
        fileArray: [
          {
            data: Array.from(firmwareData)
              .map((b) => String.fromCharCode(b))
              .join(""),
            address: 0x1000,
          },
        ],
        flashSize: "keep",
        eraseAll: false,
        compress: true,
        flashMode: "qio",
        flashFreq: "80m",
        reportProgress: (fileIndex: number, written: number, total: number) => {
          progressCallback((written / total) * 100);
        },
      };

      await this.espLoader.writeFlash(flashOptions);
      await this.espLoader.after();

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      if (this.transport) {
        await this.transport.disconnect();
        this.transport = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }

      this.espLoader = null;
      return true;
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      return false;
    }
  }
}

const flashServiceInstance = new FlashService();
export default flashServiceInstance;
