import { createHttpClient } from '@wix/http-client';
import cache from "./cache";
import uploadImage from "./uploadImage";
import path from 'path';
import fs from 'fs';
//import chalk from "chalk";

const client = createHttpClient({
    timeout: 600000,
    headers: {
        'x-wix-model-hub-timeout': '600000',
        'x-time-budget': '600000',
    }
});

const SERVERLESS_ENDPOINT = 'https://bo.wix.com/_serverless/ace-serverless/text-prompt';

const PROMPT_IDS = {
    // GPT-4o
    GPT4O_WITH_IMAGE: '79e72bc3-8686-4241-8e0f-33b2c7542aca',
    GPT4O_WITH_2_IMAGES: '27873adb-ddfd-475d-a801-d8c058803d43',
    GPT4O_WITHOUT_IMAGE: 'a6fdac52-cf45-456a-96d2-167b76a90600',

    // Gemini
    GEMINI_WITH_IMAGE: 'abd61604-1695-44dd-9e30-504a46bfec35',
    GEMINI_WITH_2_IMAGES: 'fc41a99f-3b83-498b-83b8-ae9b93adb363',
    GEMINI_WITHOUT_IMAGE: '93d36080-e7d6-401f-9957-257ef69b0f99',

    SONNET: 'aab6ed21-1262-4517-a46d-276ed356dcc6',
    
};

export type Model = 'gpt-4o' | 'gemini';

interface RunPromptParams {
    prompt: string;
    imagePath?: string;
    secondImagePath?: string;
    taskDescription: string;
    useCache?: boolean;
    model: Model;
}

const post = async (body: any) => {
    const response = await client.post(SERVERLESS_ENDPOINT, body);

    // @ts-ignore-next-line
    const generatedText = response?.data?.response?.generatedTexts?.[0];
    if (!generatedText) {
        throw new Error('Failed to generate text');
    }

    //console.log(chalk.gray.bold('Response from the model:'));
    //console.log(chalk.gray(generatedText));

    return generatedText;
}

const postWithCache = cache.memoize(post);

type PromptBody = {
    promptId: string;
    prompt: string;
    image?: string;
    secondImage?: string;
};

/*
export const runLocalPrompt = async (prompt: string): Promise<string> => {
    try {
        const prompt = 'Write a TypeScript function to calculate the factorial of a number';
        const code = await generateCode(prompt);
        console.log('Generated code:');
        console.log(code);
        return code;
      } catch (error) {
        console.error('Error:', error);
        return '';
      }
}
      */

export const runPrompt = async (
    { prompt, imagePath, secondImagePath, useCache = true, taskDescription = '', model = 'gpt-4o' }: RunPromptParams
): Promise<string | undefined> => {
    const [image, secondImage] = await Promise.all([
        imagePath ? uploadImage(imagePath) : Promise.resolve(undefined),
        secondImagePath ? uploadImage(secondImagePath) : Promise.resolve(undefined),
    ]);

    const isGPT4o = model === 'gpt-4o';
    
    const promptId = PROMPT_IDS.SONNET;
    
    /*const promptId = image && secondImage
        ? isGPT4o ? PROMPT_IDS.GPT4O_WITH_2_IMAGES : PROMPT_IDS.GEMINI_WITH_2_IMAGES
        : image
            ? isGPT4o ? PROMPT_IDS.GPT4O_WITH_IMAGE : PROMPT_IDS.GEMINI_WITH_IMAGE
            : isGPT4o ? PROMPT_IDS.GPT4O_WITHOUT_IMAGE : PROMPT_IDS.GEMINI_WITHOUT_IMAGE;
    */
    const body: PromptBody = {
        promptId,
        prompt,
        image,
        secondImage
    };

    //console.log(chalk.greenBright(`Task: ${taskDescription}`));
    //console.log(chalk.blueBright(`Prompt Length: ${prompt.length}`));
    //console.log(chalk.blueBright(`Prompt: ${prompt}`));


    for (let retries = 0; retries < 10; retries++) {
        try {
            return useCache ? postWithCache(body) : post(body);
        } catch (error: any) {
            console.error(`Attempt ${retries + 1} failed: ${error.message} (${taskDescription})`);
            if (retries >= 2) {
                console.error(`Max retries reached. Failing... (${taskDescription})`);
                throw error;
            }
            await handleRetry(prompt);
        }
    }
};

const handleRetry = async (prompt: string) => {
    const date = new Date().toISOString().replace(/:/g, '-');
    const filename = path.join(__dirname, 'failing-prompts', `failing-prompt-${date}.txt`);
    fs.writeFileSync(filename, prompt);
    console.log(`Stored failing prompt to: ${filename}. Waiting for 30 seconds before retrying...`);
    await new Promise(resolve => setTimeout(resolve, 30000));
};