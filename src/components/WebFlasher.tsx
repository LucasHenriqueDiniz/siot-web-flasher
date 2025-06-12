import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import flashService from "../services/flashService";
import SimpleTerminal, { TerminalRef } from "./SimpleTerminal";

interface WebFlasherProps {
  firmwareVersions: { version: string; url: string }[];
  onSuccess?: () => void;
  setHasStabilizedConnection: React.Dispatch<React.SetStateAction<boolean>>;
}

const WebFlasher: React.FC<WebFlasherProps> = ({ firmwareVersions, onSuccess, setHasStabilizedConnection }) => {
  const [selectedFirmware, setSelectedFirmware] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [baudRate, setBaudRate] = useState("115200");
  const [flashAddress, setFlashAddress] = useState("0x1000");
  const terminalRef = useRef<TerminalRef>(null);

  // Set up terminal when component is mounted
  useEffect(() => {
    if (terminalRef.current) {
      // Create a terminal adapter that implements the interface expected by the service
      const terminalAdapter = {
        clean: () => {
          if (terminalRef.current) {
            terminalRef.current.clear();
          }
        },
        writeLine: (data: string) => {
          if (terminalRef.current) {
            terminalRef.current.writeLine(data);
          }
        },
        write: (data: string | Uint8Array) => {
          if (terminalRef.current) {
            // if is Uint8Array or ArrayBuffer, convert to string
            if (data instanceof Uint8Array || (data as any).buffer instanceof ArrayBuffer) {
              const decoder = new TextDecoder();
              terminalRef.current.write(decoder.decode(data as Uint8Array));
            } else {
              terminalRef.current.write(data as string);
            }
          }
        },
      };

      // Register the terminal adapter in the service
      flashService.setTerminal(terminalAdapter);
    }
  }, []);

  const addLog = (message: string) => {
    if (terminalRef.current) {
      const timestamp = new Date().toLocaleTimeString();
      terminalRef.current.writeLine(`[${timestamp}] ${message}`);
    }
  };

  const showStatus = (type: "success" | "error" | "info", message: string) => {
    setStatusMessage({ type, message });
    addLog(message);
  };

  const handleConnect = async () => {
    try {
      showStatus("info", "Trying to connect to device...");

      // Clear the terminal before connecting
      if (terminalRef.current) {
        terminalRef.current.clear();
        terminalRef.current.writeLine("Trying to connect to device...");
      }

      const result = await flashService.connect(parseInt(baudRate));
      if (result.success) {
        setIsConnected(true);
        setHasStabilizedConnection(true);
        showStatus("success", "Device connected successfully!");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error while connecting";
      showStatus("error", `Failed to connect: ${errorMessage}`);
      console.error("Error connecting:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      showStatus("info", "Disconnecting device...");
      await flashService.disconnect();
      setIsConnected(false);
      setHasStabilizedConnection(false);

      if (terminalRef.current) {
        terminalRef.current.writeLine("Device disconnected");
      }

      showStatus("success", "Device disconnected successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error while disconnecting";
      showStatus("error", `Failed to disconnect: ${errorMessage}`);
      console.error("Erro ao desconectar:", error);
    }
  };

  const handleErase = async () => {
    try {
      setIsFlashing(true);
      setShowEraseConfirm(false);
      setProgress(0);
      showStatus("info", "Starting flash erase...");
      await flashService.eraseFlash();
      setProgress(100);
      showStatus("success", "Flash memory erased successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error while erasing";
      showStatus("error", `Failed to erase flash memory: ${errorMessage}`);
      console.error("Error erasing:", error);
    } finally {
      setIsFlashing(false);
    }
  };

  const handleFlash = async () => {
    if (!selectedFirmware) {
      setStatusMessage({ type: "error", message: "Select a firmware first" });
      if (terminalRef.current) {
        terminalRef.current.writeLine("Error: No firmware selected");
      }
      return;
    }

    try {
      setIsFlashing(true);
      setStatusMessage({ type: "info", message: "Starting firmware flash..." });
      setProgress(0);

      if (terminalRef.current) {
        terminalRef.current.clear();
        terminalRef.current.writeLine("Starting firmware flash process...");
      }

      const firmware = firmwareVersions.find((f) => f.version === selectedFirmware);
      if (!firmware) {
        throw new Error("Firmware not found");
      }

      addLog(`Starting firmware flash from URL: ${firmware.url}`);
      addLog(`Using flash address: 0x${parseInt(flashAddress, 16).toString(16)}`);

      await flashService.flashFirmware(
        firmware.url,
        (progress) => {
          setProgress(progress);
        },
        (message) => {
          addLog(message);
          setStatusMessage({ type: "info", message });
        },
        parseInt(flashAddress, 16)
      );

      setStatusMessage({ type: "success", message: "Firmware installed successfully!" });
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage({ type: "error", message: `Error: ${errorMessage}` });
      addLog(`Error: ${errorMessage}`);
    } finally {
      setIsFlashing(false);
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Snackbar
        open={!!statusMessage}
        autoHideDuration={6000}
        onClose={() => setStatusMessage(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setStatusMessage(null)}
          severity={statusMessage?.type}
          sx={{ width: "100%" }}
        >
          {statusMessage?.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={showEraseConfirm}
        onClose={() => setShowEraseConfirm(false)}
      >
        <DialogTitle>Attention</DialogTitle>
        <DialogContent>
          <Typography>You are about to erase the entire flash memory of the device. This action cannot be undone. Do you want to continue?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEraseConfirm(false)}>Cancel</Button>
          <Button
            onClick={handleErase}
            color="error"
            variant="contained"
          >
            Erase Flash
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleConnect}
          disabled={isConnected}
        >
          Connect Device
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDisconnect}
          disabled={!isConnected}
        >
          Disconnect
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => setShowEraseConfirm(true)}
          disabled={!isConnected || isFlashing}
        >
          Erase Flash
        </Button>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
        <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
          <FormControl fullWidth>
            <InputLabel>Baud Rate</InputLabel>
            <Select
              value={baudRate}
              onChange={(e) => setBaudRate(e.target.value)}
              disabled={isConnected}
            >
              <MenuItem value="9600">9600</MenuItem>
              <MenuItem value="19200">19200</MenuItem>
              <MenuItem value="38400">38400</MenuItem>
              <MenuItem value="57600">57600</MenuItem>
              <MenuItem value="115200">115200</MenuItem>
              <MenuItem value="230400">230400</MenuItem>
              <MenuItem value="460800">460800</MenuItem>
              <MenuItem value="921600">921600</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
          <FormControl fullWidth>
            <InputLabel>Firmware Version</InputLabel>
            <Select
              value={selectedFirmware}
              onChange={(e) => setSelectedFirmware(e.target.value)}
              disabled={!isConnected || isFlashing}
              defaultValue={firmwareVersions[0]?.version || ""}
            >
              {firmwareVersions.map((firmware) => (
                <MenuItem
                  key={firmware.version}
                  value={firmware.version}
                >
                  {firmware.version}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {isConnected && (
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Endereço Flash"
            value={flashAddress}
            onChange={(e) => setFlashAddress(e.target.value)}
            disabled={isFlashing}
            placeholder="0x1000"
            helperText="Address in hexadecimal (ex: 0x1000)"
          />
        </Box>
      )}

      {isFlashing && (
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="body2"
            sx={{ mb: 0.5 }}
          >
            Progress: {progress}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 10,
              borderRadius: 5,
              backgroundColor: "rgba(0, 0, 0, 0.1)",
              "& .MuiLinearProgress-bar": {
                borderRadius: 5,
                backgroundColor: "primary.main",
              },
            }}
          />
        </Box>
      )}

      <Button
        variant="contained"
        color="primary"
        onClick={handleFlash}
        disabled={!isConnected || !selectedFirmware || isFlashing}
        fullWidth
        sx={{ mb: 2 }}
      >
        {isFlashing ? `Flashing...` : "Start Flash"}
      </Button>

      <Box sx={{ mb: 2, height: "300px" }}>
        <SimpleTerminal
          ref={terminalRef}
          height="300px"
          backgroundColor="#121212"
          textColor="#f0f0f0"
          fontSize={14}
          fontFamily="'Consolas', 'Courier New', monospace"
          autoScroll={true}
          parseAnsi={true}
        />
      </Box>
    </Box>
  );
};

export default WebFlasher;
