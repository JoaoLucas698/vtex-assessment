import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from '@shared/errors/all-exceptions.filter';

/** ConfiguraÃ§Ã£o HTTP compartilhada entre `main.ts` e os testes e2e. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  });

  const config = new DocumentBuilder()
    .setTitle('Catalog Consolidation API')
    .setDescription(
      'ConsolidaÃ§Ã£o de catÃ¡logo de marketplace: importaÃ§Ã£o de produtos de sellers sem duplicar o catÃ¡logo.',
    )
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });
}
