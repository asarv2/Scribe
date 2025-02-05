import ReactMarkdown from 'react-markdown';
import RemarkMathPlugin from 'remark-math';
import RehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function Latex({ children }: { children: string }) {
    return (
        <div className="latex-container">
            <ReactMarkdown 
                remarkPlugins={[RemarkMathPlugin]} 
                rehypePlugins={[RehypeKatex]}
                components={{
                    p: ({children}) => <p className="latex-paragraph mb-4">{children}</p>,
                    h1: ({children}) => <h1 className="mb-4">{children}</h1>,
                    h2: ({children}) => <h2 className="mb-3">{children}</h2>,
                    br: () => <br />,
                    ul: ({children}) => <ul className="mb-4 ml-6">{children}</ul>,
                    ol: ({children}) => <ol className="mb-4 ml-6">{children}</ol>,
                }}
            >
                {children}
            </ReactMarkdown>
            <style jsx global>{`
                .latex-container {
                    font-size: 1rem;
                    line-height: 1.6;
                }
                
                .latex-paragraph {
                    margin-bottom: 1rem;
                    white-space: pre-line;
                }

                .katex-display {
                    margin: 1.5rem 0 !important;
                    overflow-x: auto;
                    overflow-y: hidden;
                }

                .katex {
                    text-rendering: auto;
                    padding: 0 0.2em;
                }
            `}</style>
        </div>
    );
}