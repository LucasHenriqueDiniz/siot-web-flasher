import React, { useState, useRef, useEffect } from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import consoleTestService from "../../services/consoleTestService";
import SimpleTerminal, { TerminalRef } from "../SimpleTerminal/SimpleTerminal";

// Componente para testar leitura serial usando nosso terminal simplificado
const SimpleSerialConsole: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [baudRate, setBaudRate] = useState("115200");
  const terminalRef = useRef<TerminalRef>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [inputMessage, setInputMessage] = useState("");

  // Configura o terminal adapter para o serviço de console quando o componente monta
  useEffect(() => {
    if (terminalRef.current) {
      // Cria um adaptador para o terminal que implementa a interface esperada pelo serviço
      const terminalAdapter = {
        write: (data: string | Uint8Array) => {
          if (terminalRef.current) {
            // Se for um Uint8Array, converte para string
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

      // Registra o adaptador do terminal no serviço
      consoleTestService.setTerminal(terminalAdapter);
    }
  }, []);

  const handleConnect = async () => {
    try {
      setStatusMessage("Conectando ao dispositivo...");

      // Limpa o terminal antes de conectar
      if (terminalRef.current) {
        terminalRef.current.clear();
        terminalRef.current.writeLine("Conectando ao dispositivo...");
      }

      const success = await consoleTestService.connectConsole(parseInt(baudRate));

      if (success) {
        setIsConnected(true);
        setStatusMessage("Dispositivo conectado com sucesso");

        if (terminalRef.current) {
          terminalRef.current.writeLine("Dispositivo conectado com sucesso!");
          terminalRef.current.writeLine(`Baud rate: ${baudRate}`);
          terminalRef.current.writeLine("Para iniciar a leitura, clique em 'Iniciar Leitura'");
        }
      }
    } catch (error) {
      setStatusMessage(`Erro ao conectar: ${error instanceof Error ? error.message : "Desconhecido"}`);
      if (terminalRef.current) {
        terminalRef.current.writeLine(`Erro ao conectar: ${error instanceof Error ? error.message : "Desconhecido"}`);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      setStatusMessage("Desconectando dispositivo...");

      await consoleTestService.stopConsole();

      setIsConnected(false);
      setIsReading(false);
      setStatusMessage("Dispositivo desconectado");

      if (terminalRef.current) {
        terminalRef.current.writeLine("Dispositivo desconectado");
      }
    } catch (error) {
      setStatusMessage(`Erro ao desconectar: ${error instanceof Error ? error.message : "Desconhecido"}`);
      if (terminalRef.current) {
        terminalRef.current.writeLine(`Erro ao desconectar: ${error instanceof Error ? error.message : "Desconhecido"}`);
      }
    }
  };

  const handleStartReading = async () => {
    try {
      setStatusMessage("Iniciando leitura...");
      setIsReading(true);

      if (terminalRef.current) {
        terminalRef.current.writeLine("Iniciando leitura serial...");
      }

      // Inicia a leitura em segundo plano para não bloquear a UI
      (async () => {
        try {
          await consoleTestService.startConsoleRead();
        } catch (error) {
          console.error("Erro na leitura:", error);
          setIsReading(false);
          if (terminalRef.current) {
            terminalRef.current.writeLine(`Erro na leitura: ${error instanceof Error ? error.message : "Desconhecido"}`);
          }
        }
      })();
    } catch (error) {
      setStatusMessage(`Erro ao iniciar leitura: ${error instanceof Error ? error.message : "Desconhecido"}`);
      setIsReading(false);
    }
  };

  const handleStopReading = async () => {
    try {
      setStatusMessage("Parando leitura...");
      await consoleTestService.stopConsole();
      setIsReading(false);
      setStatusMessage("Leitura parada");
    } catch (error) {
      setStatusMessage(`Erro ao parar leitura: ${error instanceof Error ? error.message : "Desconhecido"}`);
    }
  };

  const handleReset = async () => {
    try {
      setStatusMessage("Resetando dispositivo...");
      await consoleTestService.reset();
      setStatusMessage("Dispositivo resetado");
    } catch (error) {
      setStatusMessage(`Erro ao resetar: ${error instanceof Error ? error.message : "Desconhecido"}`);
    }
  };

  const handleSendData = async () => {
    if (!inputMessage.trim()) return;

    try {
      await consoleTestService.sendData(inputMessage);

      // Adiciona a mensagem enviada no terminal
      if (terminalRef.current) {
        terminalRef.current.writeLine(`>>> ${inputMessage}`);
      }

      setInputMessage("");
    } catch (error) {
      setStatusMessage(`Erro ao enviar dados: ${error instanceof Error ? error.message : "Desconhecido"}`);
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
      <Typography
        variant="h5"
        gutterBottom
      >
        Console Serial Simplificado
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2 }}
      >
        Esta implementação usa terminal próprio simplificado e sem dependências externas.
      </Typography>

      <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <FormControl sx={{ minWidth: 150 }}>
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

      <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConnect}
          disabled={isConnected}
        >
          Conectar
        </Button>

        <Button
          variant="contained"
          color="secondary"
          onClick={handleDisconnect}
          disabled={!isConnected}
        >
          Desconectar
        </Button>

        <Button
          variant="contained"
          color="success"
          onClick={handleStartReading}
          disabled={!isConnected || isReading}
        >
          Iniciar Leitura
        </Button>

        <Button
          variant="contained"
          color="error"
          onClick={handleStopReading}
          disabled={!isReading}
        >
          Parar Leitura
        </Button>

        <Button
          variant="outlined"
          onClick={handleReset}
          disabled={!isConnected}
        >
          Reset Dispositivo
        </Button>
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
          placeholder="Enviar comando..."
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
          Enviar
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

export default SimpleSerialConsole;
