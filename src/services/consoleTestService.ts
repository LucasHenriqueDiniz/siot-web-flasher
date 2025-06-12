import { Transport } from "esptool-js";
import { serial as webSerialPolyfill } from "web-serial-polyfill";

// Usar polyfill se a API Web Serial nativa não estiver disponível, exatamente como no exemplo
const serialLib = !navigator.serial && navigator.usb ? webSerialPolyfill : navigator.serial;

interface Terminal {
  write(data: string | Uint8Array): void;
  writeln(data: string): void;
  clear(): void;
}

export class ConsoleTestService {
  private device: any = null;
  private transport: Transport | null = null;
  private isConsoleClosed: boolean = false;
  private terminal: Terminal | null = null;

  setTerminal(terminal: Terminal) {
    this.terminal = terminal;
  }

  async connectConsole(baudRate: number = 115200): Promise<boolean> {
    try {
      if (this.device === null) {
        // Exatamente como no exemplo: sem filtros para mostrar todos dispositivos
        this.device = await serialLib.requestPort({
          filters: [], // Empty array to show all devices
        });

        this.transport = new Transport(this.device, true);
      }

      console.log("Connecting to device with baudRate:", baudRate);

      if (this.transport) {
        await this.transport.connect(baudRate);
        this.isConsoleClosed = false;
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erro ao conectar:", error);
      throw error;
    }
  }

  async startConsoleRead() {
    if (!this.transport || !this.terminal) {
      throw new Error("Transport ou Terminal não disponíveis");
    }

    try {
      this.isConsoleClosed = false;
      console.log("Starting console read loop");

      // Exatamente como no exemplo, loop síncrono
      while (true && !this.isConsoleClosed) {
        const readLoop = this.transport.rawRead();
        const { value, done } = await readLoop.next();

        if (done || !value) {
          break;
        }

        // Escreve diretamente os bytes no terminal, sem processamento
        this.terminal.write(value);

        // Log hexadecimal dos bytes para debug
        const bytes = new Uint8Array(value.buffer);
        let hexString = "";
        for (let i = 0; i < bytes.length; i++) {
          hexString += bytes[i].toString(16).padStart(2, "0") + " ";
        }
        console.log("Raw Read bytes:", hexString);
      }

      console.log("Quitting console");
    } catch (error) {
      console.error("Erro na leitura do console:", error);
      throw error;
    }
  }

  async stopConsole() {
    this.isConsoleClosed = true;
    if (this.transport) {
      await this.transport.disconnect();
      await this.transport.waitForUnlock(1500);
    }
    if (this.terminal) {
      this.terminal.clear();
    }
    this.cleanUp();
  }

  async reset() {
    if (this.transport) {
      await this.transport.setDTR(false);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.transport.setDTR(true);
    }
  }

  private cleanUp() {
    this.device = null;
    this.transport = null;
  }

  isConnected(): boolean {
    return this.transport !== null;
  }
  async sendData(data: string): Promise<void> {
    if (!this.transport) {
      throw new Error("Transport não disponível");
    }

    try {
      // Implementação exatamente como no exemplo original
      const encoder = new TextEncoder();
      const dataWithNewLine = data.endsWith("\r\n") ? data : data + "\r\n";
      const dataArray = encoder.encode(dataWithNewLine);

      // Usar um writer da porta serial diretamente
      if (this.device?.writable) {
        const writer = this.device.writable.getWriter();
        try {
          await writer.write(dataArray);
        } finally {
          writer.releaseLock();
        }
      }
    } catch (error) {
      console.error("Erro ao enviar dados:", error);
      throw error;
    }
  }
}

const consoleTestService = new ConsoleTestService();
export default consoleTestService;
