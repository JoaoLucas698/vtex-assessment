import { Badge } from '@components/badge';
import {
  TEMPLATE_FIELDS,
  TEMPLATE_FILE_NAME,
  TEMPLATE_RULES,
  templateJson,
} from '@features/catalog-import/catalog-file-template';
import styles from '@features/catalog-import/file-template.module.css';

function downloadTemplate() {
  const blob = new Blob([templateJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = TEMPLATE_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

/** Bloco recolhível com o formato esperado do arquivo de carga e um modelo para baixar. */
export function FileTemplate() {
  return (
    <details className={styles.template}>
      <summary className={styles.summary}>
        Formato esperado do arquivo
        <span className={styles.hint}>campos, regras e exemplo</span>
      </summary>
      <div className={styles.body}>
        <div>
          <h3 className={styles.heading}>Campos de cada item</h3>
          <ul className={styles.fields} aria-label="Campos do arquivo">
            {TEMPLATE_FIELDS.map((field) => (
              <li key={field.name} className={styles.field}>
                <span className={styles.fieldHead}>
                  <code className={styles.fieldName}>{field.name}</code>
                  <Badge tone={field.required ? 'danger' : 'neutral'}>
                    {field.required ? 'obrigatório' : 'opcional'}
                  </Badge>
                  <span className={styles.fieldType}>{field.type}</span>
                </span>
                <span className={styles.fieldDescription}>{field.description}</span>
              </li>
            ))}
          </ul>
          <h3 className={styles.heading}>Regras do arquivo</h3>
          <ul className={styles.rules}>
            {TEMPLATE_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className={styles.exampleHead}>
            <h3 className={styles.heading}>Exemplo</h3>
            <button type="button" onClick={downloadTemplate}>
              Baixar modelo
            </button>
          </div>
          <pre className={styles.code} aria-label="Exemplo de arquivo">
            <code>{templateJson()}</code>
          </pre>
        </div>
      </div>
    </details>
  );
}
