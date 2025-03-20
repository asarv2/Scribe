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
                    p: ({children}) => <p className="prose-p">{children}</p>,
                    h1: ({children}) => <h1 className="prose-h1">{children}</h1>,
                    h2: ({children}) => <h2 className="prose-h2">{children}</h2>,
                    ul: ({children}) => <ul className="prose-ul">{children}</ul>,
                    ol: ({children}) => <ol className="prose-ol">{children}</ol>,
                    li: ({children}) => <li className="prose-li">{children}</li>,
                }}
            >
                {children}
            </ReactMarkdown>
            <style jsx global>{`
                .latex-container {
                    font-size: 1rem;
                    line-height: 1.75;
                }
                
                .prose-p {
                    margin: 1.25em 0;
                }

                .latex-container > :first-child {
                    margin-top: 0;
                }

                .latex-container > :last-child {
                    margin-bottom: 0;
                }

                .prose-h1 {
                    margin: 2em 0 1em;
                    font-size: 2em;
                }

                .prose-h2 {
                    margin: 1.5em 0 0.75em;
                    font-size: 1.5em;
                }

                .prose-ul, .prose-ol {
                    margin: 1.25em 0;
                    padding-left: 1.625em;
                }

                .prose-li {
                    margin: 0.5em 0;
                    padding-left: 0.375em;
                }

                .katex-display {
                    margin: 1em 0 !important;
                    overflow-x: auto;
                    overflow-y: hidden;
                }

                .katex {
                    text-rendering: auto;
                }
            `}</style>
        </div>
    );
}