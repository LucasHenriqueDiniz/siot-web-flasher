import React, { useState, useRef, useEffect } from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography, Paper, Alert, Snackbar } from "@mui/material";
import flashService from "../../services/flashService";

const SerialConsole: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [serialLog, setSerialLog] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [baudRate, setBaudRate] = useState("115200");
  const serialLogRef = useRef<HTMLDivElement>(null);
  const isConsoleClosed = useRef(false);

  useEffect(() => {
    return () => {
      isConsoleClosed.current = true;
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSerialLog((prev) => [...prev, `[${timestamp}] ${message}`]);
    if (serialLogRef.current) {
      serialLogRef.current.scrollTop = serialLogRef.current.scrollHeight;
    }
  };

  const showStatus = (type: "success" | "error" | "info", message: string) => {
    setStatusMessage({ type, message });
    addLog(message);
  };

  const handleConnect = async () => {
    try {
      showStatus("info", "Tentando conectar ao dispositivo...");
      const result = await flashService.connect(parseInt(baudRate));
      if (result.success) {
        setIsConnected(true);
        showStatus("success", "Dispositivo conectado com sucesso!");
        startConsole();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao conectar";
      showStatus("error", `Falha ao conectar: ${errorMessage}`);
      console.error("Erro ao conectar:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      showStatus("info", "Desconectando dispositivo...");
      isConsoleClosed.current = true;
      await flashService.disconnect();
      setIsConnected(false);
      setSerialLog([]);
      showStatus("success", "Dispositivo desconectado com sucesso!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao desconectar";
      showStatus("error", `Falha ao desconectar: ${errorMessage}`);
      console.error("Erro ao desconectar:", error);
    }
  };

  const startConsole = async () => {
    try {
      const transport = flashService.getTransport();
      if (!transport) {
        showStatus("error", "Transport não disponível");
        return;
      }

      await transport.connect(parseInt(baudRate));
      isConsoleClosed.current = false;

      while (true && !isConsoleClosed.current) {
        const readLoop = transport.rawRead();
        const { value, done } = await readLoop.next();

        if (done || !value) {
          break;
        }

        const text = new TextDecoder().decode(value);
        addLog(text);
      }
      showStatus("info", "Console encerrado");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      showStatus("error", `Erro no console: ${errorMessage}`);
      console.error("Erro no console:", error);
    }
  };

  const stopConsole = async () => {
    isConsoleClosed.current = true;
    const transport = flashService.getTransport();
    if (transport) {
      await transport.disconnect();
      await transport.waitForUnlock(1500);
    }
    setSerialLog([]);
    showStatus("info", "Console encerrado");
  };

  const copyTrace = () => {
    const trace = serialLog.join("\n");
    navigator.clipboard.writeText(trace);
    showStatus("success", "Log copiado para a área de transferência!");
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

      <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleConnect}
          disabled={isConnected}
        >
          Conectar Dispositivo
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDisconnect}
          disabled={!isConnected}
        >
          Desconectar
        </Button>
        <Button
          variant="contained"
          color="info"
          onClick={copyTrace}
          disabled={serialLog.length === 0}
        >
          Copiar Log
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
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

      <Paper
        ref={serialLogRef}
        sx={{
          p: 2,
          height: "300px",
          overflowY: "auto",
          backgroundColor: "#121212",
          color: "#f0f0f0",
          fontFamily: "monospace",
          mb: 2,
          borderRadius: 2,
        }}
      >
        {serialLog.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </Paper>
    </Box>
  );
};

export default SerialConsole;
