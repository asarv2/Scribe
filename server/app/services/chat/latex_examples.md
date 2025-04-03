# LaTeX Formatting Examples for ScribeLec

This document provides examples of correct LaTeX formatting for mathematical expressions, symbols, and notations in ScribeLec.

## Basic Formatting Rules

1. Regular text should be wrapped in `\text{}` tags
2. Mathematical expressions, symbols, and notations should be in math mode (not inside `\text{}`)
3. Use proper LaTeX commands for mathematical symbols and operators 
4. Document references (::lecture{}, ::chapter{}, etc.) should NOT be wrapped in LaTeX formatting

## Examples

### Incorrect vs Correct Formatting

#### Incorrect:
```
\text{The Big-O notation is O(n^2) and n^{1.01} \in \Omega(1.01^n)}
```

#### Correct:
```
\text{The Big-O notation is } O(n^2) \text{ and } n^{1.01} \in \Omega(1.01^n)
```

### Mathematical Symbols and Sets

#### Incorrect:
```
\text{For all x \in R, if x > 0 then x^2 > 0}
```

#### Correct:
```
\text{For all } x \in \mathbb{R}, \text{ if } x > 0 \text{ then } x^2 > 0
```

### Fractions and Exponents

#### Incorrect:
```
\text{The formula for the area of a circle is A = \pi r^2 = \pi * (d/2)^2}
```

#### Correct:
```
\text{The formula for the area of a circle is } A = \pi r^2 = \pi \cdot \left(\frac{d}{2}\right)^2
```

### Greek Letters and Special Symbols

#### Incorrect:
```
\text{The probability density function of a normal distribution is f(x) = (1/(\sigma \sqrt{2\pi})) * e^(-(x-\mu)^2/(2\sigma^2))}
```

#### Correct:
```
\text{The probability density function of a normal distribution is } f(x) = \frac{1}{\sigma\sqrt{2\pi}} \cdot e^{-\frac{(x-\mu)^2}{2\sigma^2}}
```

### Summations and Products

#### Incorrect:
```
\text{The sum of the first n natural numbers is \sum_{i=1}^{n} i = n(n+1)/2}
```

#### Correct:
```
\text{The sum of the first n natural numbers is } \sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```

### Document References (Keep Outside LaTeX)

#### Incorrect:
```
\text{As we saw in ::lecture{id=abc123}, the integral \int_a^b f(x) dx can be approximated.}
```

#### Correct:
```
\text{As we saw in } ::lecture{id=abc123}, \text{ the integral } \int_a^b f(x) \, dx \text{ can be approximated.}
```

### Asymptotic Notation

#### Incorrect:
```
\text{The function f(n) = 3n^2 + 2n + 1 is in O(n^2)}
```

#### Correct:
```
\text{The function } f(n) = 3n^2 + 2n + 1 \text{ is in } O(n^2)
```

#### Incorrect:
```
\text{The function g(n) = 5n \log n + 20 is in \Theta(n \log n)}
```

#### Correct:
```
\text{The function } g(n) = 5n \log n + 20 \text{ is in } \Theta(n \log n)
```

#### Incorrect:
```
\text{The function h(n) = 2^n is in \Omega(2^n)}
```

#### Correct:
```
\text{The function } h(n) = 2^n \text{ is in } \Omega(2^n)
```

This correct approach ensures mathematical symbols and expressions use proper LaTeX rendering while keeping text and document references appropriately formatted.
