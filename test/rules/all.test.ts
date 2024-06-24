import { RuleTester, InvalidTestCase } from "@typescript-eslint/rule-tester";
import path from "path";
import rule, { RULE_NAME } from "../../src/rules/all.js";
import { afterAll, it, describe } from "vitest";

// TODO: move this to a setupFiles script
RuleTester.afterAll = afterAll;

// If you are not using vitest with globals: true (https://vitest.dev/config/#globals):
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const root = path.resolve(path.join(__dirname, "../../"));

const ruleTester: RuleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: root,
  },
});

type InvalidTestCaseWithOptionalErr = Omit<
  InvalidTestCase<"typescriptError", []>,
  "errors"
> &
  Partial<Pick<InvalidTestCase<"typescriptError", []>, "errors">>;

const generalValidStatements = [
  `
  function foo() {
    const a = 1 as number | undefined;
    a
  }
  `,
  `
  function foo() {
    const a = undefined as  {x: number} | undefined;
    const b = a?.x;
    b
  }
  `,
  `
  function foo() {
    const a = undefined as {x: () => number} | undefined;
    const b = a?.x();
    b
  }
  `,
  `
  function foo(a?: number, b?: number) {
    a
    b
  }
  foo(undefined, undefined);
  `,
  `
  function foo() {
    const a = undefined as {x: () => number} | undefined;
    const b = a?.x();
    b
  }
  `,
  `
  const a = new Array<number>();
  for (const x of a) {
    x
  }
  `,
  `
  const foo = (arg1?: string[]): string[] => 
    Array.isArray(arg1) 
        ? arg1.map((field) => \`field: \${field}\`) 
        : [];
  `,
  `
  const x: any = undefined; 
  `,
  `
  const t = {
    a: 'a'
  };
  for (const key in t) {
    key
  }
  `,
  // test for infinite recursion issue https://github.com/JaroslawPokropinski/eslint-plugin-strict-null-checks/issues/13
  `
  interface ISmRequest<TParams, TRequest> {
    params: TParams;
    request: TRequest;
  }
  const req = {
    params: 0,
    request: null
  };
  const smReq = req as unknown as ISmRequest<number, string>;
  `,
  `
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prevState: S) => S);
  function useState<S>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>] {
    throw new Error();
  }

  const [st, setSt] = useState<number>();
  setSt(undefined);
  `,
].map((st, i) => ({ name: `general valid ${i}`, code: st }));

const otherValidStatements = [
  {
    name: "with assert non nullable",
    code: `
    let app: {val: number};
    function beforeAll() {
      app = {val: 0}
    }

    function afterAll() {
      console.log(app.val)
    }
    `,
  },
];

const invalidStatemetsMemberAccess = [
  `
  function foo() {
    const a: {x: number} | undefined = undefined;
    const b: number = a.x;
    b
  }
  `,
];

const invalidStatemetsDeclaration = [
  `
  function foo() {
    const a = undefined as {x: number} | undefined;
    const b: {x: number} = a;
    b
  }
  `,
  `
  type Foo = {
    NonNullableString: string
  }
  
  const t = undefined as {x: string} | undefined;

  const data: Foo = {
    NonNullableString: t?.x, // even though we have optional chaining, undefined will still be set, the compiler/linter should know this
  }
  `,
  `
  type Foo = {
    NonNullableString: string
  }
  
  const t = {NonNullableString: undefined};

  const data: Foo = t;
  data
  `,
  `
  type Foo = {
    NullableString?: string
    NonNullableString: string
    NonNullableStringTwo: string
  }
  
  const bar = {
    NullableProperty: undefined,
  }
  
  const data: Foo = {
    NullableString: '',
    NonNullableString: bar.NullableProperty?.bla, // even though we have optional chaining, undefined will still be set, the compiler/linter should know this
    NonNullableStringTwo: bar.NullableProperty ?? '',
  }
  data
  `,
];

const invalidFunctionArguments = [
  `
  function foo(a: number) {
  }
  foo(undefined);
  `,
  `
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prevState: S) => S);
  function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
    initialState
    throw new Error();
  }

  useState<number>(null);
  `,
  `
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prevState: S) => S);
  function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
    initialState
    throw new Error();
  }

  const [st, setSt] = useState<number>(1);
  setSt(null);
  `,
];

const otherInvalidStatements: InvalidTestCaseWithOptionalErr[] = [
  {
    name: "passed nullable function",
    code: `
    type Fn = (() => void) | undefined;

    const boo = (fn?: Fn) => {
      fn();
    };

    boo();
    `,
  },
  {
    name: "error with chain",
    code: `
    const temp: () => Promise<string> = async () => {
      const test: {
        name: string | null;
      } = {
        name: null,
      };
    
      return test.name;
    };
    
    export default temp;
    `,
    errors: [
      {
        messageId: "typescriptError" as const,
        data: {
          errorMessage:
            "Type '() => Promise<string | null>' is not assignable to type '() => Promise<string>'.",
        },
      },
    ],
  },
];

/**
 * Passing nullable to a function accepting those should not give a warning.
 * issue @link https://github.com/JaroslawPokropinski/eslint-plugin-strict-null-checks/issues/19
 */
const validCallNullableArg = [
  {
    name: "valid call with undefined",
    code: `
    // test for issue 19
    function foo(v: unknown): unknown {
      return v;
    }
    foo(undefined);
    `,
  },
];

const valid = [
  ...generalValidStatements,
  ...otherValidStatements,
  ...validCallNullableArg,
];

const invalid = [
  ...invalidStatemetsMemberAccess.map((st) => ({
    code: st,
    errors: [{ messageId: "typescriptError" as const }],
  })),
  ...invalidStatemetsDeclaration.map((st) => ({
    code: st,
    errors: [{ messageId: "typescriptError" as const }],
  })),
  ...invalidFunctionArguments.map((st) => ({
    code: st,
    errors: [{ messageId: "typescriptError" as const }],
  })),
  ...otherInvalidStatements.map((st) => ({
    errors: [{ messageId: "typescriptError" as const }],
    ...st,
  })),
];

ruleTester.run(RULE_NAME, rule, {
  valid,
  invalid,
});
