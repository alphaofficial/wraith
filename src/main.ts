import { Command } from 'commander'
import { input } from '@inquirer/prompts';
import chalk from 'chalk'
import ora from 'ora'
import { LocalEmbedder } from './adapters/LocalEmbedder';
import { OpenAIChatAdapter } from './adapters/OpenAiLLM';
import { PostgresVectorStore } from './adapters/PostgresVectorStore';
import { IngestHandler } from './core/ingest-handler';
import { QueryHandler } from './core/query-handler';
import "dotenv/config";

const program = new Command()
const embeder = new LocalEmbedder(); // Changed from OpenAiEmbedder to LocalEmbedder
const llm = new OpenAIChatAdapter();
const vectorStore = new PostgresVectorStore();
const logger = {
    info: (text: string) => chalk.blue(console.log(text)),
    success: (text: string) => chalk.green(console.log(text)),
    warning: (text: string) => chalk.yellow(console.log(text)),
    error: (text: string) => chalk.red(console.log(text)),
    question: (text: string) => chalk.cyan(console.log(text)),
    source: (text: string) => chalk.gray(console.log(text))
}

program
    .name('wraith')
    .description('RAG for document Q&A')
    .version('1.0.0')


program
    .command('ingest')
    .description('Add documents to the knowledge base')
    .action(async () => {
        const pathName = await input({ message: 'Enter file or directory name' });
        console.log(chalk.blue(`📂 Ingesting documents from: ${pathName}`));

        const spinner = ora('📚 Document Ingestion started\n').start();
        const ingestion = new IngestHandler(vectorStore, embeder);
        await ingestion.run(pathName)

        spinner.stop();
        logger.success('✅ Documents ingested successfully');
        await vectorStore.close();
        await embeder.close();
        process.exit(0);
    })

program
    .command('query')
    .description('Ask questions about your documents')
    .action(async () => {
        logger.info('🤖 Ask your question')

        while (true) {
            const question = await input({
                message: chalk.cyan('Question:'),
                validate: (input) => input.length > 0 || 'Please enter a question'
            });

            if (question.toLowerCase() === 'exit') break;

            const spinner = ora('🔍 Searching...').start();

            try {
                const queryHandler = new QueryHandler(vectorStore, embeder, llm);
                const result = await queryHandler.run(question);

                spinner.stop();
                logger.success(`📝 Answer: ${result.answer}`);
                logger.source(`Sources: ${result.sources.join(', ')}`);
            } catch (error) {
                spinner.stop();
                logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        await vectorStore.close();
        await embeder.close();
        process.exit(0);
    })

program.parse()