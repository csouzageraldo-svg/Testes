import sys

from cli.flow import run_workflow
from utils import display


def main() -> None:
    try:
        run_workflow()
    except KeyboardInterrupt:
        display.info("\nOperação cancelada pelo usuário.")
        sys.exit(0)
    except EnvironmentError as e:
        display.error(str(e))
        sys.exit(1)
    except Exception as e:
        display.error(f"Erro inesperado: {e}")
        raise


if __name__ == "__main__":
    main()
