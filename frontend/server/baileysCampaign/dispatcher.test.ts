import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseMessageVariants,
  applyVariables,
  renderMessage,
  randomDelayMs,
  MAX_MESSAGE_VARIANTS,
} from "./dispatcher";

describe("parseMessageVariants", () => {
  it("faz parse de um array JSON de variações", () => {
    expect(parseMessageVariants(JSON.stringify(["A", "B", "C"]))).toEqual(["A", "B", "C"]);
  });

  it("descarta variações vazias ou só com espaços", () => {
    expect(parseMessageVariants(JSON.stringify(["A", "", "   ", "B"]))).toEqual(["A", "B"]);
  });

  it("trata uma string única como variação única", () => {
    expect(parseMessageVariants(JSON.stringify("Olá"))).toEqual(["Olá"]);
  });

  it("trata texto não-JSON como variação única", () => {
    expect(parseMessageVariants("texto cru")).toEqual(["texto cru"]);
  });

  it("retorna array vazio para null/undefined/vazio", () => {
    expect(parseMessageVariants(null)).toEqual([]);
    expect(parseMessageVariants(undefined)).toEqual([]);
    expect(parseMessageVariants("")).toEqual([]);
  });
});

describe("applyVariables", () => {
  it("substitui {{nome}} pelo nome do destinatário", () => {
    expect(applyVariables("Oi {{nome}}!", { name: "Maria" })).toBe("Oi Maria!");
  });

  it("aceita espaços e maiúsculas dentro do placeholder", () => {
    expect(applyVariables("Oi {{ NOME }}!", { name: "Ana" })).toBe("Oi Ana!");
  });

  it("substitui campos customizados vindos do JSON variables", () => {
    const recipient = { name: "João", variables: JSON.stringify({ empresa: "Blue", cidade: "SP" }) };
    expect(applyVariables("{{nome}} da {{empresa}} em {{cidade}}", recipient)).toBe("João da Blue em SP");
  });

  it("placeholders sem valor viram string vazia", () => {
    expect(applyVariables("Oi {{nome}} {{sobrenome}}", { name: "Lia" })).toBe("Oi Lia ");
  });

  it("dá precedência ao valor explícito de variables sobre o name", () => {
    const recipient = { name: "Pedro", variables: JSON.stringify({ nome: "Sr. Pedro" }) };
    expect(applyVariables("{{nome}}", recipient)).toBe("Sr. Pedro");
  });

  it("ignora JSON de variables inválido sem quebrar", () => {
    expect(applyVariables("Oi {{nome}}", { name: "Rui", variables: "{nao é json" })).toBe("Oi Rui");
  });

  it("trata name ausente como vazio", () => {
    expect(applyVariables("Oi {{nome}}!", {})).toBe("Oi !");
  });
});

describe("renderMessage", () => {
  it("escolhe sempre uma variação válida e aplica personalização", () => {
    const variants = ["Oi {{nome}}", "Olá {{nome}}", "E aí {{nome}}"];
    for (let i = 0; i < 50; i++) {
      const result = renderMessage(variants, { name: "Bia" });
      expect(result.variantIndex).toBeGreaterThanOrEqual(0);
      expect(result.variantIndex).toBeLessThan(variants.length);
      expect(result.text).toContain("Bia");
      expect(result.text).toBe(applyVariables(variants[result.variantIndex], { name: "Bia" }));
    }
  });

  it("sorteia a variação de acordo com Math.random", () => {
    const variants = ["um", "dois", "tres"];
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    expect(renderMessage(variants, {}).variantIndex).toBe(2);
    spy.mockReturnValue(0);
    expect(renderMessage(variants, {}).variantIndex).toBe(0);
    spy.mockRestore();
  });

  it("lança erro quando não há variações", () => {
    expect(() => renderMessage([], { name: "X" })).toThrow();
  });

  it("MAX_MESSAGE_VARIANTS é 5", () => {
    expect(MAX_MESSAGE_VARIANTS).toBe(5);
  });
});

describe("randomDelayMs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retorna um valor dentro do intervalo [min, max] em segundos", () => {
    for (let i = 0; i < 200; i++) {
      const ms = randomDelayMs(8, 25);
      expect(ms).toBeGreaterThanOrEqual(8000);
      expect(ms).toBeLessThanOrEqual(25000);
    }
  });

  it("usa o mínimo quando Math.random retorna 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomDelayMs(8, 25)).toBe(8000);
  });

  it("usa o máximo quando Math.random retorna ~1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(randomDelayMs(8, 25)).toBe(25000);
  });

  it("normaliza intervalo invertido (min > max)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomDelayMs(25, 8)).toBe(8000);
  });

  it("nunca retorna valor negativo", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomDelayMs(-5, 10)).toBe(0);
  });
});
