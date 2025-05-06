.PHONY: venv sync format lint mypy tests coverage run

# 1. Ensure the virtual environment exists
venv:
	@python3.12 -m venv .venv 2>/dev/null || true

# 2. Install development tools
dev-tools: venv
	@./.venv/bin/python -m pip install --upgrade pip >/dev/null 2>&1
	@./.venv/bin/python -m pip install uv ruff mypy pytest pytest-asyncio coverage >/dev/null 2>&1

sync: dev-tools
	@./.venv/bin/python -m uv pip install -r app/requirements.txt

format: dev-tools
	@./.venv/bin/python -m ruff format
	@./.venv/bin/python -m ruff check --fix

lint: dev-tools
	@echo "Running linter..."
	@./.venv/bin/python -m ruff check
	@echo "All checks passed!"

mypy: dev-tools
	@./.venv/bin/python -m mypy .

tests: dev-tools
	@./.venv/bin/python -m pytest -q --disable-warnings

coverage: dev-tools
	@./.venv/bin/python -m coverage run -m pytest -q --disable-warnings
	@./.venv/bin/python -m coverage xml -o coverage.xml
	@./.venv/bin/python -m coverage report -m --fail-under=95

run: sync
	@echo "Starting the application..."
	@./.venv/bin/python app/main.py
