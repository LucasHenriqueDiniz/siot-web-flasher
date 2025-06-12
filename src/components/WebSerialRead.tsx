import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import flashReadService from "../services/flashReadService";
import SimpleTerminal, { TerminalRef } from "./SimpleTerminal";

interface SerialReadProps {
  setHasStabilizedConnection: React.Dispatch<React.SetStateAction<boolean>>;
}

const SerialRead: React.FC<SerialReadProps> = ({ setHasStabilizedConnection }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [baudRate, setBaudRate] = useState("115200");
  const terminalRef = useRef<TerminalRef>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [inputMessage, setInputMessage] = useState("");
  // Set up terminal when component is mounted
  useEffect(() => {
    if (terminalRef.current) {
      // Create a terminal adapter that implements the interface expected by the service
      const terminalAdapter = {
        write: (data: string | Uint8Array) => {
          if (terminalRef.current) {
            // If it's a Uint8Array, convert to string
            if (data instanceof Uint8Array || (data as any).buffer instanceof ArrayBuffer) {
              const decoder = new TextDecoder();
              terminalRef.current.write(decoder.decode(data as Uint8Array));
            } else {
              terminalRef.current.write(data as string);
            }
          }
        },
        writeln: (data: string) => {
          if (terminalRef.current) {
            terminalRef.current.writeLine(data);
          }
        },
        clear: () => {
          if (terminalRef.current) {
            terminalRef.current.clear();
          }
        },
      };

      // Register the terminal adapter in the service
      flashReadService.setTerminal(terminalAdapter);
    }
  }, []);
  const handleConnect = async () => {
    try {
      setStatusMessage("Connecting to device...");

      // Clear the terminal before connecting
      if (terminalRef.current) {
        terminalRef.current.clear();
        terminalRef.current.writeLine("Connecting to device...");
      }

      const success = await flashReadService.connectConsole(parseInt(baudRate));

      if (success) {
        setIsConnected(true);
        setHasStabilizedConnection(true);
        setStatusMessage("Device connected successfully");

        if (terminalRef.current) {
          terminalRef.current.writeLine("Device connected successfully!");
          terminalRef.current.writeLine(`Baud rate: ${baudRate}`);
          terminalRef.current.writeLine("To start reading, click 'Start Monitoring'");
        }
      }
    } catch (error) {
      setStatusMessage(`Connection error: ${error instanceof Error ? error.message : "Unknown"}`);
      if (terminalRef.current) {
        terminalRef.current.writeLine(`Connection error: ${error instanceof Error ? error.message : "Unknown"}`);
      }
    }
  };
  const handleDisconnect = async () => {
    try {
      setStatusMessage("Disconnecting device...");

      await flashReadService.stopConsole();

      setIsConnected(false);
      setHasStabilizedConnection(false);
      setIsReading(false);
      setStatusMessage("Device disconnected");

      if (terminalRef.current) {
        terminalRef.current.writeLine("Device disconnected");
      }
    } catch (error) {
      setStatusMessage(`Disconnection error: ${error instanceof Error ? error.message : "Unknown"}`);
      if (terminalRef.current) {
        terminalRef.current.writeLine(`Disconnection error: ${error instanceof Error ? error.message : "Unknown"}`);
      }
    }
  };
  const handleStartReading = async () => {
    try {
      setStatusMessage("Starting reading...");
      setIsReading(true);

      if (terminalRef.current) {
        terminalRef.current.writeLine("Starting serial reading...");
      }

      // Start reading in the background to avoid blocking the UI
      (async () => {
        try {
          await flashReadService.startConsoleRead();
        } catch (error) {
          console.error("Error reading:", error);
          setIsReading(false);
        }
      })();
    } catch (error) {
      setStatusMessage(`Error starting reading: ${error instanceof Error ? error.message : "Unknown"}`);
      setIsReading(false);
    }
  };
  const handleStopReading = async () => {
    try {
      setStatusMessage("Stopping reading...");
      await flashReadService.stopConsole();
      setIsReading(false);
      setStatusMessage("Reading stopped");
    } catch (error) {
      setStatusMessage(`Error stopping reading: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  };
  const handleReset = async () => {
    try {
      setStatusMessage("Resetting device...");
      await flashReadService.reset();
      setStatusMessage("Device reset");
    } catch (error) {
      setStatusMessage(`Error resetting device: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  };
  const handleSendData = async () => {
    if (!inputMessage.trim()) return;

    try {
      await flashReadService.sendData(inputMessage);

      // Add the sent message to the terminal
      if (terminalRef.current) {
        terminalRef.current.writeLine(`>>> ${inputMessage}`);
      }

      setInputMessage("");
    } catch (error) {
      setStatusMessage(`Error sending data: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  };

  // Função para lidar com tecla Enter no input
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSendData();
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConnect}
          disabled={isConnected}
        >
          Connect Device
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleDisconnect}
          disabled={!isConnected}
        >
          Disconnect Device
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleStartReading}
          disabled={!isConnected || isReading}
        >
          Start Monitoring
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleStopReading}
          disabled={!isReading}
        >
          Stop Reading
        </Button>
        <Button
          variant="outlined"
          onClick={handleReset}
          disabled={!isConnected}
        >
          Reset Device
        </Button>
      </Box>
      <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <FormControl sx={{ minWidth: 150, width: "100%" }}>
          <InputLabel id="baudrate-label">Baud Rate</InputLabel>
          <Select
            labelId="baudrate-label"
            value={baudRate}
            label="Baud Rate"
            onChange={(e) => setBaudRate(e.target.value)}
            disabled={isConnected}
          >
            <MenuItem value="9600">9600</MenuItem>
            <MenuItem value="19200">19200</MenuItem>
            <MenuItem value="38400">38400</MenuItem>
            <MenuItem value="57600">57600</MenuItem>
            <MenuItem value="74880">74880</MenuItem>
            <MenuItem value="115200">115200</MenuItem>
            <MenuItem value="230400">230400</MenuItem>
            <MenuItem value="460800">460800</MenuItem>
            <MenuItem value="921600">921600</MenuItem>
          </Select>
        </FormControl>
      </Box>
      {/* Terminal de saída simplificado */}
      <Box sx={{ mb: 2, height: "300px" }}>
        <SimpleTerminal
          ref={terminalRef}
          height="300px"
          backgroundColor="#121212"
          textColor="#f0f0f0"
          fontSize={14}
          fontFamily="'Consolas', 'Courier New', monospace"
          autoScroll={true}
        />
      </Box>

      {/* Input para enviar dados */}
      <Box sx={{ mb: 2, display: "flex", gap: 1 }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={!isReading}
          placeholder="Send command..."
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />
        <Button
          variant="contained"
          onClick={handleSendData}
          disabled={!isReading || !inputMessage.trim()}
        >
          Send
        </Button>
      </Box>

      {statusMessage && (
        <Typography
          color="text.secondary"
          variant="body2"
        >
          Status: {statusMessage}
        </Typography>
      )}
    </Box>
  );
};

export default SerialRead;
