import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Container, Snackbar, Tab, Tabs, Typography } from "@mui/material";
import React, { useState } from "react";
import WebFlasher from "../components/WebFlasher";
import SerialRead from "../components/WebSerialRead";

// List of available firmware versions
// This should ideally be fetched from a server or defined in a configuration file
// For simplicity, we define it here as a constant and put the files in the firmwares directory
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
          To change mode, you need to disconnect the device to avoid errors.
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
            <Typography variant="h6">How to use</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>
              This web flasher allows you to install S-IoT firmware directly from your browser, without the need for additional software installation.
            </Typography>
            <Typography>
              <strong>Steps:</strong>
            </Typography>
            <ol>
              <li>
                <Typography>Connect your ESP32/ESP8266 device to the computer via USB cable</Typography>
              </li>
              <li>
                <Typography>Click on "Connect Device" and select the appropriate port</Typography>
              </li>
              <li>
                <Typography>Select the desired firmware version</Typography>
              </li>
              <li>
                <Typography>Click on "Start Flash" to begin the process</Typography>
              </li>
              <li>
                <Typography>When prompted, press the BOOT button on your ESP device</Typography>
              </li>
            </ol>
            <Alert
              variant="outlined"
              severity="info"
              sx={{ mt: 2 }}
            >
              This flasher works in Chrome and Edge browsers on Windows, macOS, and Linux computers.
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
            <Typography variant="h6">Compatible Devices</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>The S-IoT Web Flasher is compatible with a wide range of ESP devices:</Typography>
            <ul>
              <li>
                <Typography>
                  <strong>Espressif Chips:</strong> ESP32, ESP32-S2, ESP32-S3, ESP8266
                </Typography>
              </li>
            </ul>
            <Alert
              variant="outlined"
              severity="success"
              sx={{ mt: 2 }}
            >
              The S-IoT firmware is optimized for ESP32 modules, providing better performance and stability.
            </Alert>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Tabs to switch between flasher and console */}
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
            console.log("Flash completed successfully!");
          }}
        />
      </Box>

      <Box
        sx={{ pt: 3 }}
        hidden={tabValue !== 1}
      >
        <SerialRead setHasStabilizedConnection={setConnected} />
      </Box>
    </Container>
  );
};
