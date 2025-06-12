//Simple Terminal Component to use in the application
import { Box, styled } from "@mui/material";
import React, { useCallback, useEffect, useRef, useState } from "react";

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

// Interface for the API exposed to manipulate the terminal externally
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

// Colors and styles for ANSI codes
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

// Function to process an ANSI code and return the new style
const processAnsiCode = (currentStyle: React.CSSProperties, code: number): React.CSSProperties => {
  const newStyle = { ...currentStyle };

  // Reset
  if (code === 0) {
    return {};
  }
  // Basic text color
  else if (code >= 30 && code <= 37) {
    newStyle.color = ANSI_COLORS.foreground[code - 30];
  }
  // Bright text colors
  else if (code >= 90 && code <= 97) {
    newStyle.color = ANSI_COLORS.brightForeground[code - 90];
  }
  // Basic background colors
  else if (code >= 40 && code <= 47) {
    newStyle.backgroundColor = ANSI_COLORS.background[code - 40];
  }
  // Bold
  else if (code === 1) {
    newStyle.fontWeight = "bold";
  }
  // Italic
  else if (code === 3) {
    newStyle.fontStyle = "italic";
  }
  // Underline
  else if (code === 4) {
    newStyle.textDecoration = "underline";
  }

  return newStyle;
};

// Function to parse ANSI text and return an array of styled tokens
const parseAnsiText = (text: string): AnsiToken[] => {
  // Escape character for ANSI sequences
  // ANSI escape sequences start with ESC followed by '[' and end with 'm'
  const ESC = "\u001b";

  const result: AnsiToken[] = [];
  let currentStyle: React.CSSProperties = {};
  let currentText = "";
  let inEscapeSequence = false;
  let escapeBuffer = "";

  // Process the text character by character
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Check if it's the start of an escape sequence
    if (char === ESC && i + 1 < text.length && text[i + 1] === "[") {
      // If we have accumulated text, save it with the current style
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

    // If we are processing an escape sequence
    if (inEscapeSequence) {
      // If we encounter 'm', it's the end of the escape sequence
      if (char === "m") {
        inEscapeSequence = false;

        // Process the codes in the escape sequence
        const codes = escapeBuffer.split(";").map((c) => parseInt(c, 10) || 0);

        // Apply each style code sequentially
        for (const code of codes) {
          currentStyle = processAnsiCode(currentStyle, code);
        }
      } else {
        // Accumulate characters from the escape sequence
        escapeBuffer += char;
      }

      continue;
    }

    // Normal text
    currentText += char;
  }

  // Add the remaining text (if any)
  if (currentText) {
    result.push({
      text: currentText,
      style: { ...currentStyle },
    });
  }

  return result;
};

// Terminal container styled with MUI
const TerminalContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  overflowY: "auto",
  overflowX: "hidden",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  padding: theme.spacing(1.5),
  outline: "none",
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

// Cursor blinking
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

// Component SimpleTerminal
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

  // Process ANSI codes when content changes
  useEffect(() => {
    if (parseAnsi) {
      setParsedContent(parseAnsiText(content));
    }
  }, [content, parseAnsi]);

  // Function to scroll to the bottom when content changes
  const scrollToBottom = useCallback(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [autoScroll]);

  // Update scroll position when content changes
  useEffect(() => {
    scrollToBottom();
  }, [content, parsedContent, scrollToBottom]);

  // ref methods to manipulate the terminal
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

  // Render ANSI formatted text
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
      tabIndex={0}
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
