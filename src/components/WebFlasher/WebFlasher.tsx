import React, { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  TextField,
  Paper,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from "@mui/material";
import flashService from "../../services/flashService";

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
  const [serialLog, setSerialLog] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [baudRate, setBaudRate] = useState("115200");
  const [flashAddress, setFlashAddress] = useState("0x1000");

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSerialLog((prev) => [...prev, `[${timestamp}] ${message}`]);
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
        setHasStabilizedConnection(true);
        showStatus("success", "Dispositivo conectado com sucesso!");
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
      await flashService.disconnect();
      setIsConnected(false);
      setHasStabilizedConnection(false);
      setSerialLog([]);
      showStatus("success", "Dispositivo desconectado com sucesso!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao desconectar";
      showStatus("error", `Falha ao desconectar: ${errorMessage}`);
      console.error("Erro ao desconectar:", error);
    }
  };

  const handleErase = async () => {
    try {
      setIsFlashing(true);
      setShowEraseConfirm(false);
      setProgress(0);
      showStatus("info", "Iniciando apagamento da memória flash...");
      await flashService.eraseFlash();
      setProgress(100);
      showStatus("success", "Memória flash apagada com sucesso!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao apagar";
      showStatus("error", `Falha ao apagar memória: ${errorMessage}`);
      console.error("Erro ao apagar:", error);
    } finally {
      setIsFlashing(false);
    }
  };

  const handleFlash = async () => {
    if (!selectedFirmware) {
      setStatusMessage({ type: "error", message: "Selecione um firmware primeiro" });
      return;
    }

    try {
      setIsFlashing(true);
      setStatusMessage({ type: "info", message: "Iniciando flash do firmware..." });
      setProgress(0);
      setSerialLog([]);

      const firmware = firmwareVersions.find((f) => f.version === selectedFirmware);
      if (!firmware) {
        throw new Error("Firmware não encontrado");
      }

      addLog(`Iniciando flash do firmware da URL: ${firmware.url}`);
      addLog(`Usando endereço de flash: 0x${parseInt(flashAddress, 16).toString(16)}`);

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

      setStatusMessage({ type: "success", message: "Firmware instalado com sucesso!" });
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      setStatusMessage({ type: "error", message: `Erro: ${errorMessage}` });
      addLog(`Erro: ${errorMessage}`);
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
        <DialogTitle>Atenção</DialogTitle>
        <DialogContent>
          <Typography>Você está prestes a apagar toda a memória flash do dispositivo. Esta ação não pode ser desfeita. Deseja continuar?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEraseConfirm(false)}>Cancelar</Button>
          <Button
            onClick={handleErase}
            color="error"
            variant="contained"
          >
            Apagar
          </Button>
        </DialogActions>
      </Dialog>

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
          color="warning"
          onClick={() => setShowEraseConfirm(true)}
          disabled={!isConnected || isFlashing}
        >
          Apagar Flash
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
            <InputLabel>Versão do Firmware</InputLabel>
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
            helperText="Endereço em hexadecimal (ex: 0x1000)"
          />
        </Box>
      )}

      {isFlashing && (
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="body2"
            sx={{ mb: 0.5 }}
          >
            Progresso: {progress}%
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
        {isFlashing ? `Flasheando...` : "Iniciar Flash"}
      </Button>

      <Paper
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

export default WebFlasher;
