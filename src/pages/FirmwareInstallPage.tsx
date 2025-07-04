import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  LinearProgress,
  Snackbar,
  Typography,
  Paper,
} from "@mui/material";
import React, { useCallback, useRef, useState } from "react";
import flashReadService from "../services/flashReadService";
import flashService from "../services/flashService";
import SimpleTerminal, { TerminalRef } from "../components/SimpleTerminal";

type Step = "install" | "log" | "completed";

export const FirmwareInstallPage: React.FC = () => {
  // Estados principais
  const [currentStep, setCurrentStep] = useState<Step>("install");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Estados da etapa de instalação
  const [selectedFirmware, setSelectedFirmware] = useState<File | null>(null);
  const [flashProgress, setFlashProgress] = useState<number>(0);

  // Estados da etapa de log
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [echoDetected, setEchoDetected] = useState<boolean>(false);
  const [echoResponses, setEchoResponses] = useState<string[]>([]);

  // Estados de feedback
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>("Aguardando seleção de firmware");
  const [howToUseExpanded, setHowToUseExpanded] = useState<boolean>(false);

  const terminalRef = useRef<TerminalRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    if (terminalRef.current) {
      let prefix = "";
      let color = "";

      switch (type) {
        case "error":
          prefix = "❌";
          color = "\x1b[31m";
          break;
        case "success":
          prefix = "✅";
          color = "\x1b[32m";
          break;
        default:
          prefix = "ℹ️";
          color = "\x1b[36m";
      }

      terminalRef.current.writeLine(`${color}${prefix} ${message}\x1b[0m`);
    }
  }, []);

  const handleFileSelect = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setSelectedFirmware(file);
        setCurrentStatus(`Firmware selecionado: ${file.name}`);
        addLog(`Firmware selecionado: ${file.name}`, "success");
      }
    },
    [addLog]
  );

  const handleInstallFirmware = async () => {
    if (!selectedFirmware) {
      setStatusMessage({ type: "error", message: "Por favor, selecione um arquivo de firmware primeiro" });
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentStatus("Conectando ao dispositivo...");
      addLog("Iniciando instalação do firmware", "info");

      const result = await flashService.connect(115200);
      if (!result.success) {
        throw new Error(result.error || "Falha ao conectar");
      }

      setCurrentStatus("Instalando firmware...");
      const fileUrl = URL.createObjectURL(selectedFirmware);
      const address = 0x0;

      await flashService.flashFirmware(
        fileUrl,
        (progress) => {
          setFlashProgress(progress);
          setCurrentStatus(`Instalando firmware ${progress}%`);
        },
        () => {},
        address
      );

      URL.revokeObjectURL(fileUrl);
      await flashService.disconnect();

      setCurrentStatus("Firmware instalado com sucesso!");
      addLog("Firmware instalado com sucesso", "success");
      setStatusMessage({ type: "success", message: "Firmware instalado! Agora você pode monitorar os logs." });

      // Avançar para próxima etapa
      setCurrentStep("log");
      setFlashProgress(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      setCurrentStatus("Falha na instalação");
      addLog(`Falha na instalação: ${errorMessage}`, "error");
      setStatusMessage({ type: "error", message: `Erro: ${errorMessage}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnectSerial = async () => {
    try {
      setIsProcessing(true);
      setCurrentStatus("Conectando para monitorar logs...");
      addLog("Conectando à porta serial", "info");

      const success = await flashReadService.connectConsole(115200);
      if (success) {
        setIsConnected(true);
        setCurrentStatus("Conectado - monitorando logs");
        addLog("Conectado com sucesso", "success");

        // Configurar terminal
        flashReadService.setTerminal({
          write: (data: string | Uint8Array) => {
            if (terminalRef.current) {
              if (data instanceof Uint8Array) {
                const decoder = new TextDecoder();
                const text = decoder.decode(data);
                terminalRef.current.write(text);

                // Detectar início da fase Echo e enviar comando automaticamente
                if (text.includes("Echo for 5s Begin:")) {
                  setCurrentStatus("Fase Echo detectada - enviando comando...");
                  setTimeout(async () => {
                    try {
                      await flashReadService.sendData("Ola");
                      addLog("Comando 'Ola' enviado automaticamente", "info");
                    } catch (error) {
                      addLog("Erro ao enviar comando", "error");
                    }
                  }, 500);
                }

                // Detectar respostas individuais do Echo
                if (text.includes("Echo: ")) {
                  const echoMatch = text.match(/Echo: (.)/);
                  if (echoMatch && echoMatch[1] && echoMatch[1].trim() !== "") {
                    const echoChar = echoMatch[1];
                    setEchoResponses((prev) => {
                      const newResponses = [...prev, echoChar];
                      // Se ainda não detectou echo completo, verificar se temos resposta
                      if (!echoDetected && newResponses.length > 0) {
                        setEchoDetected(true);
                        setCurrentStatus("ECHO LOCALIZADO!");
                        setStatusMessage({ type: "success", message: "Echo detectado nos logs!" });
                        setCurrentStep("completed");
                      }
                      return newResponses;
                    });
                  }
                }
              } else {
                terminalRef.current.write(data);

                // Detectar início da fase Echo e enviar comando automaticamente
                if (data.includes("Echo for 5s Begin:")) {
                  setCurrentStatus("Fase Echo detectada - enviando comando...");
                  setTimeout(async () => {
                    try {
                      await flashReadService.sendData("Ola");
                      addLog("Comando 'Ola' enviado automaticamente", "info");
                    } catch (error) {
                      addLog("Erro ao enviar comando", "error");
                    }
                  }, 500);
                }

                // Detectar respostas individuais do Echo
                if (data.includes("Echo: ")) {
                  const echoMatch = data.match(/Echo: (.)/);
                  if (echoMatch && echoMatch[1] && echoMatch[1].trim() !== "") {
                    const echoChar = echoMatch[1];
                    setEchoResponses((prev) => {
                      const newResponses = [...prev, echoChar];
                      // Se ainda não detectou echo completo, verificar se temos resposta
                      if (!echoDetected && newResponses.length > 0) {
                        setEchoDetected(true);
                        setCurrentStatus("ECHO LOCALIZADO!");
                        setStatusMessage({ type: "success", message: "Echo detectado nos logs!" });
                        setCurrentStep("completed");
                      }
                      return newResponses;
                    });
                  }
                }
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
        });

        // Reiniciar dispositivo para ver logs completos
        setTimeout(async () => {
          try {
            await flashReadService.reset();
            addLog("Dispositivo reiniciado", "info");
            setCurrentStatus("Monitorando logs - aguardando echo...");
          } catch (error) {
            addLog("Falha ao reiniciar, mas continuando...", "error");
          }
        }, 1000);

        // Iniciar leitura
        setTimeout(async () => {
          try {
            await flashReadService.startConsoleRead();
          } catch (error) {
            console.error("Erro ao ler console:", error);
          }
        }, 1500);
      } else {
        throw new Error("Falha ao conectar à porta serial");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      setCurrentStatus("Falha na conexão");
      addLog(`Falha na conexão: ${errorMessage}`, "error");
      setStatusMessage({ type: "error", message: `Erro: ${errorMessage}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      // Desconectar sem limpar o terminal - fazer a desconexão manualmente
      if (flashReadService) {
        // Marcar como fechado para parar o loop de leitura
        (flashReadService as any).isConsoleClosed = true;

        // Desconectar o transport se existir, mas sem chamar stopConsole que limpa o terminal
        if ((flashReadService as any).transport) {
          await (flashReadService as any).transport.disconnect();
          await (flashReadService as any).transport.waitForUnlock(1500);
        }

        // Limpar apenas as variáveis internas, sem chamar terminal.clear()
        (flashReadService as any).device = null;
        (flashReadService as any).transport = null;
      }

      setIsConnected(false);
      setCurrentStatus("Desconectado - logs mantidos");
      addLog("Dispositivo desconectado (logs mantidos)", "info");
    } catch (error) {
      addLog("Erro ao desconectar", "error");
    }
  };

  const handleDisconnectAndClear = async () => {
    try {
      await flashReadService.stopConsole();
      setIsConnected(false);
      setCurrentStatus("Desconectado");
      addLog("Desconectado", "info");
    } catch (error) {
      addLog("Erro ao desconectar", "error");
    }
  };

  const handleReset = () => {
    setCurrentStep("install");
    setSelectedFirmware(null);
    setFlashProgress(0);
    setIsConnected(false);
    setEchoDetected(false);
    setEchoResponses([]);
    setCurrentStatus("Aguardando seleção de firmware");
    if (terminalRef.current) {
      terminalRef.current.clear();
    }
    addLog("Sistema reiniciado", "info");
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case "install":
        return "Etapa 1: Instalação do Firmware";
      case "log":
        return "Etapa 2: Monitoramento de Logs";
      case "completed":
        return "Processo Concluído";
      default:
        return "";
    }
  };

  return (
    <Container
      maxWidth="lg"
      sx={{ py: 4 }}
    >
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

      <Typography
        variant="body1"
        align="center"
        sx={{ mb: 4, color: "#6c757d" }}
      >
        🔧 Processo em 2 etapas: Instalar Firmware → Monitorar Logs
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Accordion
          expanded={howToUseExpanded}
          onChange={(event, isExpanded) => setHowToUseExpanded(isExpanded)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel1a-content"
            id="panel1a-header"
          >
            <Typography variant="h6">Como usar este instalador</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography
              variant="body2"
              sx={{ mb: 2 }}
            >
              <strong>Etapa 1 - Instalação:</strong>
            </Typography>
            <Typography
              variant="body2"
              sx={{ mb: 1 }}
            >
              • Selecione um arquivo de firmware (.bin)
            </Typography>
            <Typography
              variant="body2"
              sx={{ mb: 1 }}
            >
              • Clique em "Instalar Firmware" e escolha a porta serial
            </Typography>
            <Typography
              variant="body2"
              sx={{ mb: 2 }}
            >
              • Aguarde a instalação ser concluída (endereço 0x0)
            </Typography>
            <Typography
              variant="body2"
              sx={{ mb: 2 }}
            >
              <strong>Etapa 2 - Monitoramento:</strong>
            </Typography>
            <Typography
              variant="body2"
              sx={{ mb: 1 }}
            >
              • Clique em "Conectar e Monitorar" (nova conexão)
            </Typography>
            <Typography
              variant="body2"
              sx={{ mb: 1 }}
            >
              • O sistema detectará automaticamente a fase "Echo"
            </Typography>
            <Typography
              variant="body2"
              sx={{ mb: 1 }}
            >
              • Enviará o comando "Ola" automaticamente
            </Typography>
            <Typography variant="body2">• Mostrará as respostas do dispositivo quando detectadas</Typography>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Indicador de etapas */}
      <Paper sx={{ p: 2, mb: 4, backgroundColor: "#2e2e2e", color: "#fff" }}>
        <Box sx={{ display: "flex", justifyContent: "center", gap: 4, mb: 2 }}>
          <Box sx={{ textAlign: "center" }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: currentStep === "install" ? "#2196f3" : "#555",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: currentStep === "install" ? "white" : "#ccc",
                fontWeight: "bold",
                mb: 1,
                mx: "auto",
              }}
            >
              1
            </Box>
            <Typography
              variant="caption"
              color={currentStep === "install" ? "primary" : "textSecondary"}
            >
              Install
            </Typography>
          </Box>

          <Box sx={{ textAlign: "center" }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: currentStep === "log" ? "#2196f3" : currentStep === "completed" ? "#4caf50" : "#555",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: currentStep === "log" || currentStep === "completed" ? "white" : "#ccc",
                fontWeight: "bold",
                mb: 1,
                mx: "auto",
              }}
            >
              2
            </Box>
            <Typography
              variant="caption"
              color={currentStep === "log" || currentStep === "completed" ? "primary" : "textSecondary"}
            >
              Log
            </Typography>
          </Box>
        </Box>

        <Typography
          variant="h6"
          align="center"
          sx={{ color: "#fff" }}
        >
          {getStepTitle()}
        </Typography>

        <Typography
          variant="body2"
          align="center"
          sx={{ color: "#ccc", mt: 1 }}
        >
          {currentStatus}
        </Typography>
      </Paper>

      {/* Etapa 1: Instalação */}
      {currentStep === "install" && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ color: "#fff", fontWeight: "600" }}
            >
              🔧 Instalação do Firmware
            </Typography>

            <input
              type="file"
              accept=".bin"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <Box sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                onClick={handleFileSelect}
                startIcon={<CloudUploadIcon />}
                sx={{ mb: 2 }}
              >
                Selecionar Firmware (.bin)
              </Button>
              {selectedFirmware && (
                <Typography
                  variant="body2"
                  color="success.main"
                >
                  ✅ {selectedFirmware.name}
                </Typography>
              )}
            </Box>

            <Button
              variant="contained"
              color="primary"
              onClick={handleInstallFirmware}
              disabled={isProcessing || !selectedFirmware}
              startIcon={<PlayArrowIcon />}
              size="large"
            >
              {isProcessing ? "Instalando..." : "Instalar Firmware"}
            </Button>

            {isProcessing && (
              <Box sx={{ mt: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ mb: 0.5 }}
                >
                  Progresso: {flashProgress}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={flashProgress}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Etapa 2: Logs */}
      {currentStep === "log" && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ color: "#fff", fontWeight: "600" }}
            >
              📡 Monitoramento de Logs
            </Typography>

            <Typography
              variant="body2"
              sx={{ mb: 3, color: "#ccc" }}
            >
              Conecte novamente para monitorar os logs e detectar "echo"
            </Typography>

            <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleConnectSerial}
                disabled={isProcessing || isConnected}
                startIcon={<PlayArrowIcon />}
              >
                {isProcessing ? "Conectando..." : "Conectar e Monitorar"}
              </Button>

              {isConnected && (
                <Button
                  variant="outlined"
                  onClick={handleDisconnectAndClear}
                >
                  Desconectar
                </Button>
              )}
            </Box>

            {isConnected && !echoDetected && (
              <Alert
                severity="info"
                sx={{ mb: 2 }}
              >
                🔍 Monitorando logs... aguardando detectar "echo"
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Etapa Concluída */}
      {currentStep === "completed" && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ color: "#fff", fontWeight: "600" }}
            >
              🎉 Processo Concluído
            </Typography>

            <Alert
              severity="success"
              sx={{ mb: 3 }}
            >
              <Typography variant="h6">ECHO LOCALIZADO!</Typography>
              <Typography variant="body2">O firmware foi instalado e o echo foi detectado nos logs com sucesso.</Typography>
              {echoResponses.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: "bold" }}
                  >
                    Respostas recebidas:
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", backgroundColor: "#2e2e2e", color: "#fff", p: 1, borderRadius: 1 }}
                  >
                    {echoResponses.map((char, index) => `Echo: ${char}`).join(", ")}
                  </Typography>
                </Box>
              )}
            </Alert>

            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                variant="outlined"
                onClick={handleReset}
                startIcon={<RestartAltIcon />}
              >
                Iniciar Novo Processo
              </Button>

              {isConnected && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleDisconnect}
                >
                  Desconectar (Manter Logs)
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Terminal */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ color: "#fff", fontWeight: "600" }}
          >
            📟 Terminal
          </Typography>

          <SimpleTerminal
            ref={terminalRef}
            height="400px"
            backgroundColor="#1a1a1a"
            textColor="#f0f0f0"
            fontSize={14}
            fontFamily="'Consolas', 'Courier New', monospace"
            autoScroll={true}
            parseAnsi={true}
          />
        </CardContent>
      </Card>
    </Container>
  );
};
