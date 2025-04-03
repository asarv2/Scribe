/**
 * MessageViewer.tsx
 * This component is used to display a message in the viewer.
 * @AshokSaravanan222
 * 03-25-2025
 */

import { Text, Card, useMantineColorScheme } from "@mantine/core";
import styles from "./MessageViewer.module.css";
import Latex from "../Latex";

interface MessageViewerProps {
  text: string;
  handleEnhancedDocumentClick?: (
    contextType: 'lectures' | 'chapters' | 'homeworks' | 'files',
    contextId: string,
    documentId?: string,
    textbookId?: string,
    exerciseId?: string
  ) => void;
  classId?: string;
}

export default function MessageViewer({ text, handleEnhancedDocumentClick, classId }: MessageViewerProps) {
  
  // // Pre-process text to ensure math symbols are correctly formatted
  // const preprocessLatex = (content: string) => {
  //   // First clean up any double-rendered math symbols 
  //   // For example: n1.01n1.01 ∈∈ ΩΩ(1.01^n) to n1.01 ∈ Ω(1.01^n)
  //   let cleanedContent = content;
    
  //   // Clean up duplicate math symbols
  //   const mathSymbols = ['∈', 'Ω', 'O', 'Θ', 'ω', 'θ', '∀', '∃', '≤', '≥', '≠', '→', '←', '↔'];
  //   mathSymbols.forEach(symbol => {
  //     // Replace doubled/repeated symbols with a single instance
  //     const doubledSymbol = symbol + symbol;
  //     const tripleSymbol = symbol + symbol + symbol;
  //     cleanedContent = cleanedContent
  //       .replace(new RegExp(tripleSymbol, 'g'), symbol)
  //       .replace(new RegExp(doubledSymbol, 'g'), symbol);
  //   });
    
  //   // Clean up duplicated words - common in some math expressions like "n1.01n1.01"
  //   // This regex matches a word boundary, followed by word chars, then the same word immediately repeated
  //   cleanedContent = cleanedContent.replace(/\b(\w+)\s*\1\b/g, '$1');
    
  //   // Prevent line breaking within mathematical expressions by using non-breaking spaces
  //   // 1. Handle mathematical inequalities and equations (e.g., n_0 > 0, x = y, etc.)
  //   const mathOperators = ['>', '<', '=', '≥', '≤', '≠', '≈', '∈', '⊂', '⊃', '∩', '∪'];
  //   mathOperators.forEach(op => {
  //     // Replace spaces around operators with non-breaking spaces in expressions
  //     cleanedContent = cleanedContent.replace(
  //       new RegExp(`([a-zA-Z0-9_{}^\\\\(\\[]+)\\s+\\${op}\\s+([a-zA-Z0-9_{}^\\\\)\\]]+)`, 'g'),
  //       (match, left, right) => `${left}\u00A0${op}\u00A0${right}`
  //     );
  //   });
    
  //   // 2. Handle variable subscripts/superscripts to prevent breaking between them
  //   cleanedContent = cleanedContent.replace(
  //     /([a-zA-Z])_([0-9a-zA-Z])/g, 
  //     '$1_$2'
  //   );
    
  //   // 3. Keep function notation together (e.g., f(x), g(n), etc.)
  //   cleanedContent = cleanedContent.replace(
  //     /([a-zA-Z])(\s+)\(([a-zA-Z0-9])/g, 
  //     '$1\u00A0($3'
  //   );

  //   // 4. Special handling for common asymptotic notation
  //   cleanedContent = cleanedContent.replace(
  //     /(O|Θ|Ω|o|θ|ω)(\s+)\(([^)]+)\)/g,
  //     '$1\u00A0($3)'
  //   );
    
  //   // First, identify content that's already in math mode (between $ or $$) to avoid double processing
  //   const alreadyDelimitedRegex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  //   const parts = cleanedContent.split(alreadyDelimitedRegex);
    
  //   let result = '';
    
  //   for (let i = 0; i < parts.length; i++) {
  //     const part = parts[i];
      
  //     // If this part is already delimited with math symbols, keep it as is
  //     if (part.startsWith('$') && part.endsWith('$')) {
  //       result += part;
  //       continue;
  //     }
      
  //     // Process text outside of math delimiters
  //     let processedPart = part;
      
  //     // Handle general math notations when not in math mode
  //     // Match expressions with superscripts/subscripts: x^{2}, n_{i}, etc.
  //     processedPart = processedPart.replace(/([a-zA-Z0-9])\^{([^}]+)}/g, '$$$1^{$2}$$');
  //     processedPart = processedPart.replace(/([a-zA-Z0-9])_{([^}]+)}/g, '$$$1_{$2}$$');
      
  //     // One-step approach for asymptotic notation with parentheses:
  //     // Match direct asymptotic expressions like O(n), Θ(n), Ω(n), etc.
  //     processedPart = processedPart.replace(/\b([OΘΩoθω])\s*\(([^)]+)\)/g, '$$\\$1($2)$$');
      
  //     // For lone asymptotic symbols without parentheses
  //     processedPart = processedPart.replace(/\b([OΘΩoθω])\b(?!\s*\()/g, '$$\\$1$$');
      
  //     // Handle common relational operators with asymptotic notation
  //     processedPart = processedPart.replace(/([\w^{}]+)\s+\\in\s+\\([OΘΩoθω])\s*\(([^)]+)\)/g, '$$$$1 \\in \\$2($3)$$$$');
  //     processedPart = processedPart.replace(/([\w^{}]+)\s+\\in\s+\\([OΘΩoθω])/g, '$$$$1 \\in \\$2$$$$');
      
  //     // Handle expressions like "n^{1.01} \in \Omega(1.01^n)" - more specific first
  //     processedPart = processedPart.replace(
  //       /([a-zA-Z0-9](?:\^{[^}]+}|_{[^}]+}))\s+\\in\s+\\([OΘΩoθω])\s*\(([^)]+)\)/g, 
  //       '$$$$1 \\in \\$2($3)$$$$'
  //     );
      
  //     // Match simple math functions with backslash: \sin, \cos, \log, etc.
  //     processedPart = processedPart.replace(/\\([a-zA-Z]+)(\s|\()/g, '$$\\$1$$$2');
      
  //     // Match common math symbols with backslash: \in, \subset, \approx, etc.
  //     processedPart = processedPart.replace(/\\(in|subset|approx|equiv|sim|leq|geq|neq|to|rightarrow|leftarrow)\b/g, '$$\\$1$$');
      
  //     // Match Greek letters: \alpha, \beta, etc.
  //     processedPart = processedPart.replace(/\\([a-zA-Z]+)\b/g, '$$\\$1$$');
      
  //     result += processedPart;
  //   }
    
  //   return result;
  // };

  // // Process code blocks separately from LaTeX content
  // const processMessageWithCodeBlocks = (content: string) => {
  //   // Pre-process the latex
  //   const processedContent = preprocessLatex(content);
    
  //   // Split the text by code blocks
  //   const parts = processedContent.split(/(<CODE>[\s\S]*?<\/CODE>)/g);
    
  //   return parts.map((part, index) => {
  //     // If this part is a code block
  //     if (part.startsWith('<CODE>') && part.endsWith('</CODE>')) {
  //       const codeContent = part.replace('<CODE>', '').replace('</CODE>', '');
  //       return (
  //         <pre key={index} className={styles.codeBlock}>
  //           <code>{codeContent}</code>
  //         </pre>
  //       );
  //     }
      
  //     // For regular text, pass directly to Latex component
  //     // The KaTeX library used in the Latex component will handle math expressions
  //     return (
  //       <Latex key={index} classId={classId} handleEnhancedDocumentClick={handleEnhancedDocumentClick}>
  //         {part}
  //       </Latex>
  //     );
  //   });
  // };

  return (
    <Card
      className={styles.messageCard}
      padding="sm"
      radius="md"
    >
      <Latex classId={classId} handleEnhancedDocumentClick={handleEnhancedDocumentClick}>
        {text}
      </Latex>
    </Card>
  );
}

/**
 * 
<style jsx global>{`
  .katex-html {
    white-space: normal !important;
    word-wrap: break-word;
  }
  
  .katex-mathml {
    display: inline-block;
  }
  
  span.math.math-inline {
    white-space: nowrap;
    display: inline-block;
  }
  
  .katex .msupsub {
    text-align: left;
  }
`}</style>

**/