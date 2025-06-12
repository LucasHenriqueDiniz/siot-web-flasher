# SIOT Web Flasher

<div align="center">
  <h3>Instalação de firmware e monitoramento serial para ESP32/ESP8266 via navegador web</h3>
</div>

## Sobre o Projeto

O SIOT Web Flasher é um projeto de pesquisa desenvolvido para a [Engenharia do Futuro](https://engenhariadofuturo.com.br/) como parte da plataforma [SIOT - Seu IoT](http://seuiot.com.br/). Esta aplicação web permite instalar firmwares e monitorar a comunicação serial de microcontroladores ESP32/ESP8266 diretamente pelo navegador, sem necessidade de instalação de softwares adicionais.

## Funcionalidades Principais

- **Gravação de Firmware**: Instalação de firmware em dispositivos ESP diretamente pelo navegador
- **Monitor Serial**: Visualização e envio de comandos pela porta serial
- **Compatibilidade com Web Serial API**: Funciona em navegadores modernos com suporte à Web Serial API
- **Terminal com Suporte ANSI**: Visualização de logs coloridos com interpretação de códigos ANSI
- **Interface Intuitiva**: Design moderno e responsivo utilizando Material UI
- **check_coms.cmd**: Script para verificar portas seriais disponíveis no Windows

## Requisitos de Sistema

- **Navegador**: Google Chrome 89+ ou Microsoft Edge 89+ (com Web Serial API habilitada)
- **Dispositivos Compatíveis**: ESP32 e ESP8266
- **Sistemas Operacionais**: Windows, macOS, Linux

## Como Usar

1. **Conecte o dispositivo ESP** ao seu computador via cabo USB
2. **Acesse a aplicação** pelo navegador
3. **Selecione a função desejada**:
   - **Web Flasher**: Para instalar firmware
   - **Serial Monitor**: Para monitorar a comunicação serial
4. **Para flashear um dispositivo**:
   - Clique em "Conectar Dispositivo" e selecione a porta serial
   - Escolha a versão do firmware desejada (este projeto inclui nenhum firmware específico, mas você pode colocar seu proprio na pasta `firmwares` e atualizar a variável `availableFirmwares` no `src\pages\WebFlasherPage\WebFlasherPage.tsx`)
   - Configure o endereço de flash (normalmente 0x1000 ou 0x000)
   - Clique em "Iniciar Flash"
5. **Para usar o monitor serial**:
   - Conecte o dispositivo
   - Selecione o baud rate adequado
   - Clique em "Iniciar Leitura"

## Desenvolvimento

Este projeto utiliza:

- **React 19** com TypeScript
- **Material UI 7** para interface de usuário
- **esptool-js** para comunicação com dispositivos ESP
- **web-serial-polyfill** para usar polyfill se a API Web Serial nativa não estiver disponível

### Instalação para Desenvolvimento

```bash
# Clone o repositório
git clone https://github.com/LucasHenriqueDiniz/siot-web-flasher.git

# Entre no diretório
cd siot-web-flasher

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm start
```

## Limitações

- Funciona apenas em navegadores com suporte à Web Serial API (Chrome, Edge, Brave, etc.)
- Alguns sistemas operacionais podem necessitar de drivers específicos para os adaptadores USB-Serial

## Licença

Este projeto está licenciado sob a Licença Apache 2.0 - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Créditos

Inspirado por [esptool-js](https://github.com/espressif/esptool-js)
