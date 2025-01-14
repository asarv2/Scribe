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
                    p: ({children}) => <span className="latex-paragraph">{children}</span>
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
}