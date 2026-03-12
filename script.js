class ScientificCalculator {
    constructor(previousOperandTextElement, currentOperandTextElement, modeRadios) {
        this.previousOperandTextElement = previousOperandTextElement;
        this.currentOperandTextElement = currentOperandTextElement;
        this.modeRadios = modeRadios; // Radians vs Degrees
        this.clear();
        this.ans = 0; // Store previous answer
        this.history = JSON.parse(localStorage.getItem('calc-history')) || [];
        this.renderHistory();
    }

    clear() {
        this.expression = '';
        this.displayExpression = '';
        this.result = '';
        this.error = false;
        this.evaluated = false;
    }

    clearEntry() {
        if (this.error || this.evaluated) {
            this.clear();
            return;
        }
        
        // Remove the block of numbers/decimals at the end of the expression
        if (this.expression.length > 0) {
            // Match the last contiguous block of digits (including decimals). e.g., '345', '3.14'
            // OR match the last function keyword e.g., 'sin('
            const lastPartMatch = this.expression.match(/(\d+\.?\d*|sin\(|cos\(|tan\(|ln\(|log\(|√\()$/);
            
            if (lastPartMatch) {
                const lengthToRemove = lastPartMatch[0].length;
                this.expression = this.expression.slice(0, -lengthToRemove);
                
                // Keep displayExpression synced. We need to measure how the last token was displayed.
                // Operators like * display as ×, but numbers/functions string lengths match exactly.
                this.displayExpression = this.displayExpression.slice(0, -lengthToRemove);
            } else {
                // If it's just an operator (+, -, *, /) or parenthesis, remove it
                this.expression = this.expression.slice(0, -1);
                this.displayExpression = this.displayExpression.slice(0, -1);
            }
        }
    }

    delete() {
        if (this.error || this.evaluated) {
            this.clear();
            return;
        }
        // Remove the last entered token or character
        if (this.expression.length > 0) {
            // Function names like sin(, cos( are grouped, so a simple slice(-1) might leave 'si' which is invalid.
            // Let's check for functions first
            const lastFuncMatch = this.expression.match(/(sin\(|cos\(|tan\(|ln\(|log\(|√\()$/);
            if (lastFuncMatch) {
                 const lengthToRemove = lastFuncMatch[0].length;
                 this.expression = this.expression.slice(0, -lengthToRemove);
                 this.displayExpression = this.displayExpression.slice(0, -lengthToRemove);
            } else {
                 this.expression = this.expression.slice(0, -1);
                 this.displayExpression = this.displayExpression.slice(0, -1);
            }
        }
    }

    appendNumber(number) {
        if (this.error) this.clear();
        if (this.evaluated) {
            this.expression = '';
            this.displayExpression = '';
            this.evaluated = false;
        }

        // Prevent multiple decimals in the current working number
        const parts = this.expression.split(/[\+\-\*\/\^\(\)]/);
        const currentPart = parts[parts.length - 1];
        if (number === '.' && currentPart.includes('.')) return;

        this.expression += number.toString();
        this.displayExpression += number.toString();
    }

    appendOperator(operator) {
        if (this.error) this.clear();
        // If we just evaluated, use the result as the start of the next expression
        if (this.evaluated) {
            this.expression = this.result.toString();
            this.displayExpression = this.result.toString();
            this.evaluated = false;
        }

        this.expression += operator;
        
        // Make the display pretty
        let displayOp = operator;
        if (operator === '*') displayOp = '×';
        if (operator === '/') displayOp = '÷';
        if (operator === '-') displayOp = '−';

        this.displayExpression += displayOp;
    }

    appendFunction(func) {
        if (this.error) this.clear();
        if (this.evaluated) {
            this.expression = '';
            this.displayExpression = '';
            this.evaluated = false;
        }

        this.expression += func;
        this.displayExpression += func;
    }
    
    appendConstant(constant) {
        if (this.error) this.clear();
        if (this.evaluated) {
            this.expression = '';
            this.displayExpression = '';
            this.evaluated = false;
        }
        
        let val = '';
        if (constant === 'π') val = Math.PI.toString();
        if (constant === 'e') val = Math.E.toString();

        // Implicit multiplication if preceded by a number or closing paren
        if (this.expression.length > 0) {
            const lastChar = this.expression.slice(-1);
            if (/\d|\)/.test(lastChar)) {
                this.expression += '*';
            }
        }

        this.expression += val;
        this.displayExpression += constant;
    }

    appendAns() {
        if (this.error) this.clear();
        if (this.evaluated) {
            this.expression = '';
            this.displayExpression = '';
            this.evaluated = false;
        }

        // Implicit multiplication
        if (this.expression.length > 0) {
            const lastChar = this.expression.slice(-1);
            if (/\d|\)/.test(lastChar)) {
                this.expression += '*';
            }
        }

        this.expression += this.ans.toString();
        this.displayExpression += 'Ans';
    }

    getAngleMultiplier() {
        let isDeg = true;
        this.modeRadios.forEach(radio => {
            if (radio.checked && radio.value === 'rad') isDeg = false;
        });
        return isDeg ? (Math.PI / 180) : 1;
    }

    // A robust Shunting Yard + Tokenizer evaluator to avoid eval() and handle math correctly
    evaluateExpression(expr) {
        // 1. Tokenize
        // Normalize implicit multiplication e.g. 2(3) -> 2*(3) or 2sin(3) -> 2*sin(3)
        let normalizedExpr = expr.replace(/(\d)(\()/g, "$1*(")
                                 .replace(/(\))(\d)/g, "$1*$2")
                                 .replace(/(\))(\()/g, "$1*(")
                                 .replace(/(\d)(sin|cos|tan|ln|log|√)/g, "$1*$2");

        const tokens = [];
        let numBuffer = '';
        let funcBuffer = '';

        for (let i = 0; i < normalizedExpr.length; i++) {
            const char = normalizedExpr[i];

            if (/\d|\./.test(char)) {
                numBuffer += char;
            } else if (/[a-zA-Z√]/.test(char)) {
                if (numBuffer) {
                    tokens.push(numBuffer);
                    numBuffer = '';
                }
                funcBuffer += char;
                // Identify functions
                if (['sin', 'cos', 'tan', 'ln', 'log', '√'].includes(funcBuffer)) {
                    tokens.push(funcBuffer);
                    funcBuffer = '';
                }
            } else {
                if (numBuffer) {
                    tokens.push(numBuffer);
                    numBuffer = '';
                }
                
                // Handle negative numbers (unary minus) vs subtraction
                if (char === '-') {
                    if (tokens.length === 0 || ['+', '-', '*', '/', '^', '(', 'sin', 'cos', 'tan', 'ln', 'log', '√'].includes(tokens[tokens.length-1])) {
                        numBuffer += '-'; // It's part of the number
                        continue;
                    }
                }
                
                tokens.push(char);
            }
        }
        if (numBuffer) tokens.push(numBuffer);

        // 2. Shunting Yard (Infix to RPN)
        const outputQueue = [];
        const operatorStack = [];
        const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, '!': 4 };
        const rightAssociative = { '^': true };
        const isFunction = (token) => ['sin', 'cos', 'tan', 'ln', 'log', '√'].includes(token);

        for (const token of tokens) {
            if (!isNaN(parseFloat(token))) {
                outputQueue.push(parseFloat(token));
            } else if (isFunction(token)) {
                operatorStack.push(token);
            } else if (token === '!') {
                // Factorial acts immediately on the number
                outputQueue.push(token);
            } else if (precedence[token]) {
                while (
                    operatorStack.length > 0 &&
                    operatorStack[operatorStack.length - 1] !== '(' &&
                    (isFunction(operatorStack[operatorStack.length - 1]) ||
                     precedence[operatorStack[operatorStack.length - 1]] > precedence[token] ||
                     (precedence[operatorStack[operatorStack.length - 1]] === precedence[token] && !rightAssociative[token]))
                ) {
                    outputQueue.push(operatorStack.pop());
                }
                operatorStack.push(token);
            } else if (token === '(') {
                operatorStack.push(token);
            } else if (token === ')') {
                while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
                    outputQueue.push(operatorStack.pop());
                }
                if (operatorStack.length === 0) throw new Error("Mismatched parentheses");
                operatorStack.pop(); // Pop '('
                if (operatorStack.length > 0 && isFunction(operatorStack[operatorStack.length - 1])) {
                    outputQueue.push(operatorStack.pop());
                }
            }
        }

        while (operatorStack.length > 0) {
            const op = operatorStack.pop();
            if (op === '(' || op === ')') throw new Error("Mismatched parentheses");
            outputQueue.push(op);
        }

        // 3. Evaluate RPN
        const evalStack = [];
        const angleMult = this.getAngleMultiplier();

        const factorial = (n) => {
            if (n < 0 || n % 1 !== 0) throw new Error("Math Error");
            if (n === 0 || n === 1) return 1;
            let res = 1;
            for (let i = 2; i <= n; i++) res *= i;
            return res;
        };

        for (const token of outputQueue) {
            if (typeof token === 'number') {
                evalStack.push(token);
            } else if (token === '!') {
                const a = evalStack.pop();
                evalStack.push(factorial(a));
            } else if (isFunction(token)) {
                const a = evalStack.pop();
                if (a === undefined) throw new Error("Syntax Error");
                
                switch (token) {
                    case 'sin': evalStack.push(Math.sin(a * angleMult)); break;
                    case 'cos': evalStack.push(Math.cos(a * angleMult)); break;
                    case 'tan': 
                        if (Math.cos(a * angleMult) === 0) throw new Error("Math Error");
                        evalStack.push(Math.tan(a * angleMult)); 
                        break;
                    case 'ln': 
                        if (a <= 0) throw new Error("Math Error");
                        evalStack.push(Math.log(a)); 
                        break;
                    case 'log': 
                        if (a <= 0) throw new Error("Math Error");
                        evalStack.push(Math.log10(a)); 
                        break;
                    case '√': 
                        if (a < 0) throw new Error("Math Error");
                        evalStack.push(Math.sqrt(a)); 
                        break;
                }
            } else {
                const b = evalStack.pop();
                const a = evalStack.pop();
                if (a === undefined || b === undefined) throw new Error("Syntax Error");

                switch (token) {
                    case '+': evalStack.push(a + b); break;
                    case '-': evalStack.push(a - b); break;
                    case '*': evalStack.push(a * b); break;
                    case '/': 
                        if (b === 0) throw new Error("Can't divide by 0");
                        evalStack.push(a / b); 
                        break;
                    case '%': evalStack.push(a * (b / 100)); break;
                    case '^': evalStack.push(Math.pow(a, b)); break;
                }
            }
        }

        if (evalStack.length !== 1) throw new Error("Syntax Error");
        return evalStack[0];
    }

    compute() {
        if (this.error || !this.expression) return;
        
        // Auto-close open parentheses for convenience
        const openParenCount = (this.expression.match(/\(/g) || []).length;
        const closeParenCount = (this.expression.match(/\)/g) || []).length;
        if (openParenCount > closeParenCount) {
            const missing = openParenCount - closeParenCount;
            this.expression += ')'.repeat(missing);
            this.displayExpression += ')'.repeat(missing);
        }

        try {
            const rawResult = this.evaluateExpression(this.expression);
            // Fix gross JS floating point errors natively (12 decimal precision rounding)
            const cleanResult = Math.round(rawResult * 1e12) / 1e12;
            
            this.result = cleanResult;
            this.ans = cleanResult;
            this.evaluated = true;

            // Add to history
            const historyItem = {
                expression: this.displayExpression,
                result: this.result
            };
            this.history.unshift(historyItem);
            if (this.history.length > 20) this.history.pop();
            localStorage.setItem('calc-history', JSON.stringify(this.history));
            this.renderHistory();

        } catch (e) {
            this.error = e.message || "Error";
            this.evaluated = true;
        }
    }

    renderHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        historyList.innerHTML = '';
        if (this.history.length === 0) {
            historyList.innerHTML = '<div class="history-empty">No history yet</div>';
            return;
        }

        this.history.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-expression">${item.expression} =</div>
                <div class="history-result">${this.getDisplayNumber(item.result)}</div>
            `;
            // Click history item to recall
            div.addEventListener('click', () => {
                this.clear();
                this.expression = item.result.toString();
                this.displayExpression = item.result.toString();
                this.updateDisplay();
            });
            historyList.appendChild(div);
        });
    }

    clearHistory() {
        this.history = [];
        localStorage.removeItem('calc-history');
        this.renderHistory();
    }

    getDisplayNumber(number) {
        if (number === '' || number === undefined || number === null) return '';
        if (number === '-') return '-';

        const stringNumber = number.toString();
        if (stringNumber.includes('e')) {
            return Number(stringNumber).toExponential(5);
        }

        const integerDigits = parseFloat(stringNumber.split('.')[0]);
        const decimalDigits = stringNumber.split('.')[1];
        
        let integerDisplay;
        if (isNaN(integerDigits)) {
            integerDisplay = '';
        } else {
            integerDisplay = integerDigits.toLocaleString('en', { maximumFractionDigits: 0 });
        }

        if (decimalDigits != null) {
            return `${integerDisplay}.${decimalDigits}`;
        } else {
            return integerDisplay;
        }
    }

    updateDisplay() {
        if (this.error) {
            this.currentOperandTextElement.innerText = this.error;
            this.currentOperandTextElement.classList.add('error');
            this.previousOperandTextElement.innerText = this.displayExpression + ' =';
            return;
        }

        this.currentOperandTextElement.classList.remove('error');

        if (this.evaluated) {
            this.previousOperandTextElement.innerText = this.displayExpression + ' =';
            this.currentOperandTextElement.innerText = this.getDisplayNumber(this.result);
        } else {
            this.previousOperandTextElement.innerText = '';
            this.currentOperandTextElement.innerText = this.displayExpression || '0';
        }

        // Adjust font size dynamically
        const currentText = this.currentOperandTextElement.innerText;
        const charCount = currentText.length;
        if (charCount > 18) {
            this.currentOperandTextElement.style.fontSize = '1.6rem';
        } else if (charCount > 12) {
            this.currentOperandTextElement.style.fontSize = '2rem';
        } else {
            this.currentOperandTextElement.style.fontSize = '2.5rem';
        }
    }
}

// ---------------- Initialization and Events ---------------- //
const numberButtons = document.querySelectorAll('[data-number]');
const buttons = document.querySelectorAll('.calculator button');
const previousOperandTextElement = document.getElementById('previous-operand');
const currentOperandTextElement = document.getElementById('current-operand');
const modeRadios = document.querySelectorAll('input[name="angleUnit"]');

const calculator = new ScientificCalculator(previousOperandTextElement, currentOperandTextElement, modeRadios);

// Theme Toggle
const themeToggleBtn = document.getElementById('theme-toggle');
const sunIcon = themeToggleBtn.querySelector('.sun-icon');
const moonIcon = themeToggleBtn.querySelector('.moon-icon');

const currentTheme = localStorage.getItem('theme') || 'dark';
if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        
        if (isLight) {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
            localStorage.setItem('theme', 'light');
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
            localStorage.setItem('theme', 'dark');
        }
    });
}

// History Toggle
const historyToggleBtn = document.getElementById('history-toggle');
const historyPanel = document.getElementById('history-panel');

if (historyToggleBtn && historyPanel) {
    historyToggleBtn.addEventListener('click', () => {
        historyPanel.classList.toggle('hidden');
    });
}

// Clear History Button
const clearHistoryBtn = document.getElementById('clear-history');
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
        calculator.clearHistory();
    });
}

buttons.forEach(button => {
    button.addEventListener('click', () => {
        const action = button.dataset.action;
        const val = button.dataset.val;

        if (button.hasAttribute('data-number')) {
            calculator.appendNumber(button.dataset.number);
        } else if (action === 'operator') {
            calculator.appendOperator(val);
        } else if (action === 'function') {
            calculator.appendFunction(val);
        } else if (action === 'append') {
            calculator.appendOperator(val); // Works same as operator append for string building
        } else if (action === 'constant') {
            calculator.appendConstant(val);
        } else if (action === 'ans') {
            calculator.appendAns();
        } else if (action === 'calculate') {
            calculator.compute();
        } else if (action === 'clear') {
            calculator.clear();
        } else if (action === 'clear-entry') {
            calculator.clearEntry();
        } else if (action === 'delete') {
            calculator.delete();
        }
        
        calculator.updateDisplay();
    });
});

// Keyboard Support
document.addEventListener('keydown', e => {
    if ((e.key >= 0 && e.key <= 9) || e.key === '.') {
        calculator.appendNumber(e.key);
    }
    else if (e.key === '=' || e.key === 'Enter') {
        e.preventDefault();
        calculator.compute();
    }
    else if (e.key === 'Backspace') {
        calculator.delete();
    }
    else if (e.key === 'Escape') {
        calculator.clear();
    }
    else if (['+', '-', '*', '/', '^', '%', '(', ')'].includes(e.key)) {
        calculator.appendOperator(e.key);
    }
    calculator.updateDisplay();
});
