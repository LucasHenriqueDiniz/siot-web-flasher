import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, Button, Typography, Alert, CircularProgress, Paper } from "@mui/material";
import flashService from "../../services/flashService";

interface WebFlasherProps {
  firmwareVersions?: Array<{ version: string; url: string }>;
  onSuccess?: () => void;
}

const WebFlasher: React.FC<WebFlasherProps> = ({ firmwareVersions, onSuccess }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedFirmware, setSelectedFirmware] = useState<File | null>(null);
  const [chipInfo, setChipInfo] = useState("");
  const [flashResult, setFlashResult] = useState<{ success: boolean; error?: string } | null>(null);

  const outputRef = useRef<HTMLPreElement>(null);

  const terminal = useCallback(
    () => ({
      clean() {
        setLogs([]);
      },
      writeLine(data: string) {
        setLogs((prev) => [...prev, data]);
      },
      write(data: string) {
        setLogs((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex >= 0) {
            const updatedLogs = [...prev];
            updatedLogs[lastIndex] = updatedLogs[lastIndex] + data;
            return updatedLogs;
          }
          return [...prev, data];
        });
      },
    }),
    []
  );

  useEffect(() => {
    flashService.setTerminal(terminal());
  }, [terminal]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [logs]);
  const handleConnect = async () => {
    terminal().writeLine("Conectando ao dispositivo ESP...");
    const result = await flashService.connect();

    if (result.success) {
      terminal().writeLine(`Conectado com sucesso: ${result.chipInfo}`);

      // Convert ROM object to string if needed
      const chipInfoString = typeof result.chipInfo === "object" && result.chipInfo !== null ? result.chipInfo.toString() : result.chipInfo || "";

      setChipInfo(chipInfoString);
      setIsConnected(true);
    } else {
      terminal().writeLine(`Erro ao conectar: ${result.error}`);
    }
  };

  const handleDisconnect = async () => {
    await flashService.disconnect();
    setIsConnected(false);
    setChipInfo("");
    terminal().writeLine("Dispositivo desconectado.");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFirmware(file);
    }
  };

  const handleFlash = async () => {
    if (!selectedFirmware) return;

    setIsFlashing(true);
    setFlashResult(null);
    terminal().writeLine(`Iniciando flash do firmware: ${selectedFirmware.name}`);

    try {
      const fileBuffer = await selectedFirmware.arrayBuffer();
      const firmwareData = new Uint8Array(fileBuffer);

      terminal().writeLine(`Tamanho do arquivo: ${firmwareData.byteLength} bytes`);
      terminal().writeLine("Quando o terminal mostrar 'connecting...' pressione o botão BOOT no ESP");

      const result = await flashService.flashFirmware(firmwareData, (progress) => setProgress(progress));

      if (result.success) {
        terminal().writeLine("Flash concluído com sucesso!");
        setFlashResult({ success: true });
        if (onSuccess) onSuccess();
      } else {
        terminal().writeLine(`Erro durante o flash: ${result.error}`);
        setFlashResult({ success: false, error: result.error });
      }
    } catch (error) {
      terminal().writeLine(`Erro inesperado: ${(error as Error).message}`);
      setFlashResult({ success: false, error: (error as Error).message });
    } finally {
      setIsFlashing(false);
      setProgress(0);
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 600, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          gutterBottom
        >
          Web Flasher para ESP
        </Typography>

        <Button
          variant="contained"
          color={isConnected ? "error" : "primary"}
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={isFlashing}
          fullWidth
          sx={{ mb: 2 }}
        >
          {isConnected ? "Desconectar Dispositivo" : "Conectar Dispositivo"}
        </Button>

        {chipInfo && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
          >
            Dispositivo conectado: {chipInfo}
          </Alert>
        )}
      </Box>

      {isConnected && (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            gutterBottom
          >
            Selecionar Firmware
          </Typography>

          <Button
            variant="outlined"
            component="label"
            disabled={isFlashing}
            fullWidth
            sx={{ mb: 2 }}
          >
            Escolher Arquivo (.bin)
            <input
              type="file"
              accept=".bin"
              hidden
              onChange={handleFileChange}
            />
          </Button>

          {selectedFirmware && (
            <Typography
              variant="body2"
              sx={{ mb: 2 }}
            >
              Arquivo selecionado: {selectedFirmware.name}
            </Typography>
          )}

          <Button
            variant="contained"
            color="secondary"
            onClick={handleFlash}
            disabled={!selectedFirmware || isFlashing}
            fullWidth
          >
            {isFlashing ? (
              <>
                <CircularProgress
                  size={24}
                  sx={{ mr: 1, color: "white" }}
                />
                Flasheando... {progress}%
              </>
            ) : (
              "Iniciar Flash"
            )}
          </Button>
        </Box>
      )}

      <Alert
        severity="info"
        sx={{ width: "100%", mb: 2, textAlign: "center" }}
      >
        Quando o terminal exibir "connecting..." pressione o botão "boot" no seu dispositivo ESP
      </Alert>

      <Paper
        component="pre"
        sx={{
          height: "200px",
          overflow: "auto",
          width: "100%",
          whiteSpace: "pre-wrap",
          p: 2,
          mb: 2,
          fontFamily: "monospace",
          bgcolor: "#f5f5f5",
          fontSize: "0.9rem",
        }}
        ref={outputRef}
      >
        {logs.length > 0 ? (
          logs.map((log, index) => <div key={index}>{log}</div>)
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
          >
            Conecte um dispositivo para começar...
          </Typography>
        )}
      </Paper>

      {flashResult && (
        <Alert
          severity={flashResult.success ? "success" : "error"}
          sx={{ width: "100%", textAlign: "center" }}
        >
          {flashResult.success ? "Flash concluído com sucesso!" : `Falha no flash: ${flashResult.error}`}
        </Alert>
      )}
    </Box>
  );
};

export default WebFlasher;
