import { PreAction } from '@/actions/action.ts';
import { processAction } from '@/actions/processAction.ts';
import { makeTypeDef, makeTypeDefs } from '@/context/makeTypeDefs.ts';


const rootIRI = 'https://example.com';
const schema = 'https://schema.example.com';
const typeDefs = makeTypeDefs([
  makeTypeDef({
    term: 'recipeUUID',
    schema,
  }),
  makeTypeDef({
    term: 'stepPosition',
    schema,
  }),
  makeTypeDef({
    term: 'ingredient',
    schema,
  }),
  makeTypeDef({
    term: 'page',
    schema,
  }),
  makeTypeDef({
    term: 'pageSize',
    schema,
  }),
]);


const action = PreAction.new<{
  pageMultiplier: number,
}>({
  method: 'get',
  name: 'list-recipe-step-ingredients',
  actionPathPrefix: '/actions',
  rootIRI,
  urlPattern: new URLPattern('/recipes/:recipeUUID/steps/:stepPosition/ingredients', rootIRI),
})
  .define({
    spec: {
      recipeUUID: {
        typeDef: typeDefs.recipeUUID,
        dataType: 'string',
        valueRequired: false,
      },
      stepPosition: {
        typeDef: typeDefs.stepPosition,
        dataType: 'number',
        valueName: 'stepPosition',
        valueRequired: false,
      },
      page: {
        typeDef: typeDefs.page,
        dataType: 'number',
        valueName: 'page',
        valueRequired: false,
      },
      pageSize: {
        typeDef: typeDefs.pageSize,
        dataType: 'number',
        valueName: 'pageSize',
        valueRequired: false,
      },
    },
  });

await Deno.test('', async (t) => {
  await t.step('', async (t) => {
    const recipeUUID = 'xxxx-xxxx-xxxx-xxxx';
    const stepPosition = 2;
    const page = 10;
    const pageSize = 100;
    const iri = `${rootIRI}/recipes/${recipeUUID}/steps/${stepPosition}?page=${page}&pageSize=${pageSize}`

    const {} = await processAction({
      iri,
      action,
      req,
      state: { pageMultiplier: 8 },
    });
  });
})
