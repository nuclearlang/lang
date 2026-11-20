<div align="center">

<img src="https://nuclearlang.github.io/favicon.svg" alt="NuclearLang" width="96" height="96">

# NuclearLang

**Escribe solo la lógica.** Un lenguaje mínimo hecho para que lo escriban los agentes de IA y lo lean las personas.
Un solo código se convierte en TypeScript, Dart o Python, y su framework, **Synapsis**, construye apps móviles,
backends y apps web a partir de él.

[Sitio web](https://nuclearlang.github.io) · [Tutorial](nuclear-synapsis-framework/docs/08-guides/tutorial.md) ·
[Extensión de VS Code](https://marketplace.visualstudio.com/items?itemName=nuclearlang.nuclearlang) ·
[English](README.md)

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/nuclearlang/lang?color=a7ff00&label=release)](https://github.com/nuclearlang/lang/releases/latest)
[![license](https://img.shields.io/badge/license-Apache--2.0-a7ff00)](LICENSE)

</div>

## Instalar

```sh
curl -fsSL https://nuclearlang.github.io/install.sh | sh     # Linux y macOS
irm https://nuclearlang.github.io/install.ps1 | iex          # Windows (PowerShell)
```

Un comando instala el compilador, el servidor de lenguaje, la extensión del editor (VS Code, Cursor, VSCodium,
Windsurf, Zed), el servidor MCP y el Smart Graph para tus agentes de IA. `nuclear update` mantiene todas las piezas
en una misma versión.

## Treinta segundos

```sh
nuclear new todos_api -p backend && cd todos_api            # un backend: solo archivos .nuc
nuclear gen resource todos Todo --fields "id:int title:string completed:boolean"
nuclear run                                                 # FastAPI en http://localhost:8000/docs
```

Lo que escribió `nuclear gen`, y lo que tú cambiarías, es Nuclear corto (`components/todos/`):

```nuc
// Changes a todo; NotFound (404) when there is none.
usecase UpdateTodo(repository: TodoRepository)
  exec(id: int, input: NewTodo) Result<Error, Todo>
    found = ~repository.find(id)
    found.title = input.title
    found.completed = input.completed
    Ok(~repository.save(found))
```

El mismo Nuclear construye un backend NestJS (`dialect = "nestjs"`); una app Flutter con `-p mobile`; una app React
con `-p web`.

## Por qué

- **Los agentes gastan sus tokens en código que siempre es igual.** En Nuclear solo se escribe la lógica de negocio:
  los imports, el código repetitivo y el cableado los pone el dialecto.
- **Una sola forma de escribir cada cosa**, errores que traen su arreglo y definiciones de tipos de cada librería,
  para que un agente compruebe los nombres en vez de inventarlos.
- **Hecho para agentes desde el principio:** un servidor MCP, una skill para Claude Code, Codex y Cursor,
  `llms.txt` y una base de conocimiento local (el Smart Graph) que responde qué es Nuclear y cómo usarlo.
- **El resultado es lo que escribiría un experto**: FastAPI, NestJS, Flutter o React normales, legibles y rápidos;
  Nuclear nunca reemplaza las herramientas propias del lenguaje destino.

## Qué hay dentro

| Carpeta | Qué es |
|---|---|
| [nuclearlang/](nuclearlang/README.md) | el lenguaje: el compilador (Rust), el servidor de lenguaje, los dialectos |
| [nuclear-synapsis-framework/](nuclear-synapsis-framework/README.md) | Synapsis: el framework y sus tres plataformas (móvil, backend, web) |
| [tools/](tools/README.md) | el comando `nuclear`, el generador de código, el servidor MCP |
| [extensions/](extensions/README.md) | los editores (VS Code, Cursor, Android Studio, IntelliJ, Zed) y sus herramientas |
| [device-emulators/](device-emulators/README.md) | los dispositivos que ejecutan tu app dentro del editor |
| [nuclear-graph-storage/](nuclear-graph-storage/README.md) · [nuclear-agents/](nuclear-agents/README.md) | la base de conocimiento privada y los agentes locales |
| [installer/](installer/README.md) · [website/](website/README.md) | los instaladores y el sitio web |

## Aprender

- [El tutorial](nuclear-synapsis-framework/docs/08-guides/tutorial.md): una app desde cero.
- [La guía del lenguaje](nuclearlang/docs/08-guides/README.md) y [los dialectos](nuclearlang/dialects/README.md).
- [Las plataformas](nuclear-synapsis-framework/platforms/README.md).
- [AGENTS.md](AGENTS.md) y [docs/README.md](docs/README.md): el mapa y las reglas, para quienes contribuyen y para
  los agentes.

La documentación técnica está en inglés; el sitio web, la extensión y este README también hablan español.

## Comunidad

Preguntas e ideas: [GitHub Discussions](https://github.com/nuclearlang/lang/discussions). Cómo contribuir:
[CONTRIBUTING.md](CONTRIBUTING.md). Código de conducta: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Seguridad:
[SECURITY.md](SECURITY.md). Cómo se decide: [GOVERNANCE.md](GOVERNANCE.md).

Libre y de código abierto bajo la [licencia Apache 2.0](LICENSE).
