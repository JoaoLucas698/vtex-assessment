/** Formato esperado do arquivo de carga, mostrado na tela de importação. */

export interface TemplateField {
  name: string;
  required: boolean;
  type: string;
  description: string;
}

export const TEMPLATE_FIELDS: readonly TemplateField[] = [
  {
    name: 'Id',
    required: true,
    type: 'texto',
    description: 'Código do produto no sistema do seller. Reenviar o mesmo Id atualiza o item, não duplica.',
  },
  {
    name: 'SellerName',
    required: true,
    type: 'texto',
    description: 'Nome da loja. Comparado exatamente: "Mega Loja" e "mega loja" viram sellers diferentes.',
  },
  {
    name: 'Name',
    required: true,
    type: 'texto',
    description: 'Nome do produto.',
  },
  {
    name: 'Brand',
    required: false,
    type: 'texto ou null',
    description: 'Marca. Junto com o nome, identifica o mesmo produto entre sellers.',
  },
  {
    name: 'Category',
    required: false,
    type: 'texto ou null',
    description: 'Categoria. Não entra na identificação do produto.',
  },
];

export const TEMPLATE_RULES: readonly string[] = [
  'Um array JSON ([ ... ]) com um objeto por produto, mesmo que seja um só.',
  'Nomes dos campos exatamente como na lista, com maiúsculas e minúsculas.',
  'Salvo em UTF-8, com até 5 MB.',
  'Item com campo obrigatório ausente, vazio ou com tipo errado é recusado sozinho, com o motivo no relatório.',
];

export const TEMPLATE_EXAMPLE = [
  {
    Id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    SellerName: 'MegaStore',
    Name: 'Smartphone Galaxy S23',
    Brand: 'Samsung',
    Category: 'Electronics',
  },
  {
    Id: 'SKU-0042',
    SellerName: 'TechWorld',
    Name: 'Cabo USB-C 2m',
    Brand: null,
    Category: null,
  },
];

export const TEMPLATE_FILE_NAME = 'modelo-carga.json';

export function templateJson(): string {
  return `${JSON.stringify(TEMPLATE_EXAMPLE, null, 2)}\n`;
}
