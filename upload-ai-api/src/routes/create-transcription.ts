import { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { googleGenAI } from "../lib/chat-models";

export async function createTranscriptionRoute(app: FastifyInstance) {
  // o videoId pode ou não existir
  // a validação do parâmetro é feita através da biblioteca "zod"
  app.post("/videos/:videoId/transcription", async (req) => {
    // validando se o parâmetro "videoID" está de acordo com o esperado
    // é esperado que o parâmetro seja um objeto, com a propriedade "videoID" e o valor uma string do tipo "uuid"
    const paramsSchema = z.object({
      videoId: z.string().uuid(),
    });

    // usando o Schema criado para validar se o "params.req" está seguindo a estruturação criada
    // dá pra usar o destructuring para pegar a propriedade "videoId" direto
    const { videoId } = paramsSchema.parse(req.params);

    // fazendo a validação para o "prompt"
    const bodySchema = z.object({
      prompt: z.string(),
    });

    // usando o Schema criado para validar o parâmetro
    // o prompt são palavras-chave que irão ajudar a IA a ter um contexto na hora de fazer a transcrição, podendo ser palavras mais técnicas, estrangeiras ao idioma falado, entre outras
    const { prompt } = bodySchema.parse(req.body);

    // pegando o arquivo armazenado no Prisma
    const video = await prisma.video.findFirstOrThrow({
      where: {
        id: videoId,
      },
    });

    // pegando o caminho onde o arquivo foi armazenado
    const videoPath = video.path;

    //DEPRECIADO
    // usando o pacote nativo no Node, "fs", para utilizar a funcionalidade de "stream" (ler/escrever algo em partes)
    // como será feita a leitura do arquivo, será utilizado o "createReadStream"
    // const audioReadStream = createReadStream(videoPath);

    // const response = await openai.audio.transcriptions.create({
    //   file: audioReadStream,
    //   model: "whisper-1",
    //   language: "pt",
    //   response_format: "json",
    //   temperature: 0,
    //   prompt,
    // });

    const audioData = readFileSync(videoPath).toString("base64");

    const response = await googleGenAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Gere uma transcrição do áudio a seguir. Use as seguintes palavras-chave para auxiliar na transcrição: ${prompt}, caso haja. Não retorne nada além da transcrição e, se possível, o tempo de início de cada fala e quem está falando (nomeie os personagens)`,
            },
            {
              inlineData: {
                mimeType: "audio/mpeg",
                data: audioData,
              },
            },
          ],
        },
      ],
    });

    const transcription = response.text;

    await prisma.video.update({
      where: {
        id: videoId,
      },
      data: {
        transcription,
      },
    });

    return { transcription };
  });
}
