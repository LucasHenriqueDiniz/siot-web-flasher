import { Transport } from "esptool-js";
import { serial as webSerialPolyfill } from "web-serial-polyfill";

// Use polyfill if native Web Serial API is not available
const serialLib = !navigator.serial && navigator.usb ? webSerialPolyfill : navigator.serial;

interface Terminal {
  write(data: string | Uint8Array): void;
  writeln(data: string): void;
  clear(): void;
}

export class FlashReadService {
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
      console.error("Error connecting:", error);
      throw error;
    }
  }
  async startConsoleRead() {
    if (!this.transport || !this.terminal) {
      throw new Error("Transport or Terminal not available");
    }
    try {
      this.isConsoleClosed = false;
      console.log("Starting console read loop");

      // Just like in the example, synchronous loop
      while (true && !this.isConsoleClosed) {
        const readLoop = this.transport.rawRead();
        const { value, done } = await readLoop.next();

        if (done || !value) {
          break;
        } // Write bytes directly to the terminal, without processing
        this.terminal.write(value);

        // Hexadecimal log of bytes for debugging
        const bytes = new Uint8Array(value.buffer);
        let hexString = "";
        for (let i = 0; i < bytes.length; i++) {
          hexString += bytes[i].toString(16).padStart(2, "0") + " ";
        }
        console.log("Raw Read bytes:", hexString);
      }
      console.log("Quitting console");
    } catch (error) {
      console.error("Error reading console:", error);
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
      throw new Error("Transport not available");
    }

    try {
      // Implementation exactly as in the original example
      const encoder = new TextEncoder();
      const dataWithNewLine = data.endsWith("\r\n") ? data : data + "\r\n";
      const dataArray = encoder.encode(dataWithNewLine);

      // Use a serial port writer directly
      if (this.device?.writable) {
        const writer = this.device.writable.getWriter();
        try {
          await writer.write(dataArray);
        } finally {
          writer.releaseLock();
        }
      }
    } catch (error) {
      console.error("Error sending data:", error);
      throw error;
    }
  }
}

const flashReadService = new FlashReadService();
export default flashReadService;
