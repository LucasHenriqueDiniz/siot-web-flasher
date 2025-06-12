import React, { useRef, useState, useEffect, useCallback } from "react";
import { Box, styled } from "@mui/material";

interface SimpleTerminalProps {
  autoScroll?: boolean;
  fontSize?: number;
  fontFamily?: string;
  width?: string | number;
  height?: string | number;
  backgroundColor?: string;
  textColor?: string;
  onKeyPress?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  borderRadius?: number | string;
  cursor?: boolean;
  parseAnsi?: boolean;
}

// Interface para o API exposto para manipular o terminal externamente
export interface TerminalRef {
  write: (text: string) => void;
  writeLine: (text: string) => void;
  clear: () => void;
  getContent: () => string;
  focus: () => void;
}

interface AnsiToken {
  text: string;
  style?: React.CSSProperties;
}

// Cores e estilos para códigos ANSI
const ANSI_COLORS = {
  foreground: [
    "black", // 30
    "#cc0000", // 31
    "#4e9a06", // 32
    "#c4a000", // 33
    "#3465a4", // 34
    "#75507b", // 35
    "#06989a", // 36
    "#d3d7cf", // 37
  ],
  brightForeground: [
    "#555753", // 90
    "#ef2929", // 91
    "#8ae234", // 92
    "#fce94f", // 93
    "#729fcf", // 94
    "#ad7fa8", // 95
    "#34e2e2", // 96
    "#eeeeec", // 97
  ],
  background: [
    "black", // 40
    "#cc0000", // 41
    "#4e9a06", // 42
    "#c4a000", // 43
    "#3465a4", // 44
    "#75507b", // 45
    "#06989a", // 46
    "#d3d7cf", // 47
  ],
};

// Função que processa um código ANSI e retorna o novo estilo
const processAnsiCode = (currentStyle: React.CSSProperties, code: number): React.CSSProperties => {
  const newStyle = { ...currentStyle };

  // Reset
  if (code === 0) {
    return {};
  }
  // Cores básicas do texto
  else if (code >= 30 && code <= 37) {
    newStyle.color = ANSI_COLORS.foreground[code - 30];
  }
  // Cores brilhantes do texto
  else if (code >= 90 && code <= 97) {
    newStyle.color = ANSI_COLORS.brightForeground[code - 90];
  }
  // Cores básicas de fundo
  else if (code >= 40 && code <= 47) {
    newStyle.backgroundColor = ANSI_COLORS.background[code - 40];
  }
  // Negrito
  else if (code === 1) {
    newStyle.fontWeight = "bold";
  }
  // Itálico
  else if (code === 3) {
    newStyle.fontStyle = "italic";
  }
  // Sublinhado
  else if (code === 4) {
    newStyle.textDecoration = "underline";
  }

  return newStyle;
};

// Função para processar códigos ANSI
const parseAnsiText = (text: string): AnsiToken[] => {
  // Caracteres especiais para códigos ANSI
  const ESC = "\u001b";

  const result: AnsiToken[] = [];
  let currentStyle: React.CSSProperties = {};
  let currentText = "";
  let inEscapeSequence = false;
  let escapeBuffer = "";

  // Processa o texto caractere por caractere
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Verifica se é o início de uma sequência de escape
    if (char === ESC && i + 1 < text.length && text[i + 1] === "[") {
      // Se temos texto acumulado, salvamos com o estilo atual
      if (currentText) {
        result.push({
          text: currentText,
          style: { ...currentStyle },
        });
        currentText = "";
      }

      inEscapeSequence = true;
      escapeBuffer = "";
      i++; // Pula o '['
      continue;
    }

    // Se estamos processando uma sequência de escape
    if (inEscapeSequence) {
      // Se encontrarmos 'm', é o final da sequência de escape
      if (char === "m") {
        inEscapeSequence = false;

        // Processa os códigos da sequência de escape
        const codes = escapeBuffer.split(";").map((c) => parseInt(c, 10) || 0);

        // Aplica cada código de estilo sequencialmente
        for (const code of codes) {
          currentStyle = processAnsiCode(currentStyle, code);
        }
      } else {
        // Acumula caracteres da sequência de escape
        escapeBuffer += char;
      }

      continue;
    }

    // Texto normal
    currentText += char;
  }

  // Adiciona o texto restante (se houver)
  if (currentText) {
    result.push({
      text: currentText,
      style: { ...currentStyle },
    });
  }

  return result;
};

// Terminal container estilizado com MUI
const TerminalContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  overflowY: "auto",
  overflowX: "hidden",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  padding: theme.spacing(1.5),
  outline: "none", // Remove o outline padrão quando o elemento recebe foco
  borderRadius: "3px",
  boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.15)",
  "&::-webkit-scrollbar": {
    width: "10px",
    height: "10px",
  },
  "&::-webkit-scrollbar-track": {
    background: "rgba(0, 0, 0, 0.1)",
  },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(255, 255, 255, 0.2)",
    "&:hover": {
      background: "rgba(255, 255, 255, 0.3)",
    },
  },
}));

// Cursor piscante estilizado
const BlinkingCursor = styled("span")({
  display: "inline-block",
  width: "0.6em",
  height: "1.2em",
  backgroundColor: "#CCCCCC",
  marginLeft: "2px",
  animation: "blink 1s step-end infinite",
  "@keyframes blink": {
    "0%, 100%": {
      opacity: 0,
    },
    "50%": {
      opacity: 1,
    },
  },
});

// Componente de terminal simples e personalizado
const SimpleTerminal = React.forwardRef<TerminalRef, SimpleTerminalProps>((props, ref) => {
  const {
    autoScroll = true,
    fontSize = 14,
    fontFamily = "'Consolas', 'Lucida Console', monospace",
    width = "100%",
    height = "300px",
    backgroundColor = "#0C0C0C",
    textColor = "#CCCCCC",
    onKeyPress,
    onKeyDown,
    borderRadius = "3px",
    cursor = true,
    parseAnsi = true,
  } = props;

  const terminalRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<string>("");
  const [parsedContent, setParsedContent] = useState<AnsiToken[]>([]);

  // Processar códigos ANSI quando o conteúdo mudar
  useEffect(() => {
    if (parseAnsi) {
      setParsedContent(parseAnsiText(content));
    }
  }, [content, parseAnsi]);

  // Função para rolar para o final quando o conteúdo muda
  const scrollToBottom = useCallback(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [autoScroll]);

  // Atualiza a rolagem quando o conteúdo muda
  useEffect(() => {
    scrollToBottom();
  }, [content, parsedContent, scrollToBottom]);

  // Métodos expostos através da ref
  React.useImperativeHandle(ref, () => ({
    write: (text: string) => {
      setContent((prev) => prev + text);
    },
    writeLine: (text: string) => {
      setContent((prev) => prev + text + "\n");
    },
    clear: () => {
      setContent("");
    },
    getContent: () => content,
    focus: () => {
      if (terminalRef.current) {
        terminalRef.current.focus();
      }
    },
  }));

  // Renderiza texto com formatação ANSI
  const renderContent = () => {
    if (!parseAnsi) return content;

    return (
      <>
        {parsedContent.map((token, index) => (
          <span
            key={index}
            style={token.style}
          >
            {token.text}
          </span>
        ))}
      </>
    );
  };

  return (
    <TerminalContainer
      ref={terminalRef}
      sx={{
        width,
        height,
        fontSize: `${fontSize}px`,
        fontFamily,
        backgroundColor,
        color: textColor,
        borderRadius,
        border: "1px solid #383838",
        lineHeight: "1.3",
      }}
      tabIndex={0} // Para permitir foco via teclado
      onKeyPress={onKeyPress}
      onKeyDown={onKeyDown}
    >
      {renderContent()}
      {cursor && <BlinkingCursor />}
    </TerminalContainer>
  );
});

SimpleTerminal.displayName = "SimpleTerminal";

export default SimpleTerminal;
