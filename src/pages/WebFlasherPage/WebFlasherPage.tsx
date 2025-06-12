import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Alert, Box, Container, Tab, Tabs, Typography, Snackbar } from "@mui/material";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import React, { useState } from "react";
import SerialReadTest from "../../components/SerialReadTest/SerialReadTest";
import WebFlasher from "../../components/WebFlasher";

// Lista de versões de firmware disponíveis
const availableFirmwares = [{ version: "v1.0.3", url: "/firmwares/esp-client-1.0.3.bin" }];

export const WebFlasherPage: React.FC = () => {
  const [howToUseExpanded, setHowToUseExpanded] = useState<boolean>(false);
  const [compatibilityExpanded, setCompatibilityExpanded] = useState<boolean>(false);
  const [tabValue, setTabValue] = useState<number>(0);
  const [isConnected, setConnected] = useState<boolean>(false);
  const [showWarning, setShowWarning] = useState<boolean>(false);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    if (isConnected) {
      // Show warning message if connected
      setShowWarning(true);
      return;
    }
    setTabValue(newValue);
  };

  return (
    <Container
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Snackbar
        open={showWarning}
        autoHideDuration={5000}
        onClose={() => setShowWarning(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setShowWarning(false)}
          severity="warning"
          sx={{ width: "100%" }}
        >
          Para trocar de modo é necessário desconectar o dispositivo para evitar erros.
        </Alert>
      </Snackbar>

      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        align="center"
      >
        S-IoT Web Flasher
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Accordion
          expanded={howToUseExpanded}
          onChange={(event, isExpanded) => setHowToUseExpanded(isExpanded)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="howToUsePanel-content"
            id="howToUsePanel-header"
          >
            <Typography variant="h6">Como utilizar</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography paragraph>
              Este flasher web permite instalar o firmware do S-IoT diretamente pelo seu navegador, sem necessidade de instalação de software adicional.
            </Typography>
            <Typography paragraph>
              <strong>Passos:</strong>
            </Typography>
            <ol>
              <li>
                <Typography paragraph>Conecte seu dispositivo ESP32/ESP8266 ao computador via cabo USB</Typography>
              </li>
              <li>
                <Typography paragraph>Clique em "Conectar Dispositivo" e selecione a porta apropriada</Typography>
              </li>
              <li>
                <Typography paragraph>Selecione a versão do firmware desejada</Typography>
              </li>
              <li>
                <Typography paragraph>Clique em "Iniciar Flash" para começar o processo</Typography>
              </li>
              <li>
                <Typography paragraph>Quando solicitado, pressione o botão BOOT no seu dispositivo ESP</Typography>
              </li>
            </ol>
            <Alert
              variant="outlined"
              severity="info"
              sx={{ mt: 2 }}
            >
              Este flasher funciona nos navegadores Chrome e Edge em computadores com Windows, macOS e Linux.
            </Alert>
          </AccordionDetails>
        </Accordion>

        <Accordion
          expanded={compatibilityExpanded}
          onChange={(event, isExpanded) => setCompatibilityExpanded(isExpanded)}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="compatibilityPanel-content"
            id="compatibilityPanel-header"
          >
            <Typography variant="h6">Dispositivos Compatíveis</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography paragraph>O S-IoT Web Flasher é compatível com uma ampla gama de dispositivos ESP:</Typography>
            <ul>
              <li>
                <Typography paragraph>
                  <strong>ESP32:</strong> Lorem Ipsolum
                </Typography>
              </li>
            </ul>
            <Alert
              variant="outlined"
              severity="success"
              sx={{ mt: 2 }}
            >
              O firmware S-IoT é otimizado para os módulos ESP32, proporcionando melhor desempenho e estabilidade.
            </Alert>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Abas para alternar entre flasher e console */}
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="console tabs"
        >
          <Tab label="Web Flasher" />
          <Tab label="Serial Monitor" />
        </Tabs>
      </Box>

      <Box
        sx={{ pt: 3 }}
        hidden={tabValue !== 0}
      >
        <WebFlasher
          firmwareVersions={availableFirmwares}
          setHasStabilizedConnection={setConnected}
          onSuccess={() => {
            console.log("Flash concluído com sucesso!");
          }}
        />
      </Box>

      <Box
        sx={{ pt: 3 }}
        hidden={tabValue !== 1}
      >
        <SerialReadTest setHasStabilizedConnection={setConnected} />
      </Box>
    </Container>
  );
};
