import { Container, Paper, Typography } from "@mui/material";
import React from "react";
import WebFlasher from "../../components/WebFlasher";

// Lista de versões de firmware disponíveis
const availableFirmwares = [
  { version: "v1.0.0", url: "../firmwares/siot-firmware-v1.0.0.bin" },
  { version: "v1.0.3", url: "../firmwares/siot-firmware-v1.0.3.bin" },
];

export const WebFlasherPage: React.FC = () => {
  return (
    <Container
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        align="center"
      >
        S-IoT Web Flasher
      </Typography>

      <Paper
        elevation={3}
        sx={{ p: 3, mb: 4 }}
      >
        <Typography
          variant="h6"
          gutterBottom
        >
          Como utilizar
        </Typography>
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
            <Typography paragraph>Selecione o arquivo de firmware que deseja flashear</Typography>
          </li>
          <li>
            <Typography paragraph>Clique em "Iniciar Flash" para começar o processo</Typography>
          </li>
          <li>
            <Typography paragraph>Quando solicitado, pressione o botão BOOT no seu dispositivo ESP</Typography>
          </li>
        </ol>
        <Typography paragraph>
          <strong>Nota:</strong> Este flasher funciona nos navegadores Chrome e Edge em computadores com Windows, macOS e Linux.
        </Typography>
      </Paper>

      <WebFlasher
        firmwareVersions={availableFirmwares}
        onSuccess={() => {
          console.log("Flash concluído com sucesso!");
          // Redirecionar para página de configuração ou outra ação
        }}
      />
    </Container>
  );
};
