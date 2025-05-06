GOOD_EXAMPLES = [
    r"\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}",
    r"\begin{tikzpicture}\draw (0,0) circle (1cm);\end{tikzpicture}",
    r"""
    \begin{tikzpicture}
      \begin{axis}[xlabel={$x$},ylabel={$y$}]
        \addplot[domain=0:1,samples=20]{x^2};
      \end{axis}
    \end{tikzpicture}
    """,
]

BAD_EXAMPLES = [
    (r"", "No LaTeX code provided."),
    (r"\write18{rm -rf /}", "Shell-escape commands are not allowed"),
]
