import { FastifyInstance } from "fastify";
import { z } from "zod";
import { streamText } from "ai";
import { prisma } from "../lib/prisma";
import { googleProvider } from "../lib/chat-models";

export async function generateAICompletionRoute(app: FastifyInstance) {
  app.post("/ai/complete", async (req, reply) => {
    const bodySchema = z.object({
      videoId: z.string().uuid(),
      prompt: z.string(),
      temperature: z.number().min(0).max(1).default(0.5),
    });

    const { videoId, prompt, temperature } = bodySchema.parse(req.body);

    const video = await prisma.video.findFirstOrThrow({
      where: {
        id: videoId,
      },
    });

    // caso a transcrição não tenha sido gerada
    if (!video.transcription) {
      return reply
        .status(400)
        .send({ error: "Video transcription was not generate yet." });
    }

    // após a transcrição ser feita, fazer a substituição no template
    const promptMessage = prompt.replace(
      "{transcription}",
      video.transcription,
    );

    // DEPRECIADO
    // // chamada para a OpenAI
    // const response = await openai.chat.completions.create({
    //   model: "gpt-3.5-turbo",
    //   temperature,
    //   // a propriedade "messages" funciona como um histórico
    //   // a propriedade "role" está indicando que o usuário está enviando a mensagem
    //   messages: [{ role: "user", content: promptMessage }],
    //   stream: true,
    // });

    // impede o Fastify de finalizar a resposta após o handler retornar,
    // entregando o controle total do "reply.raw" para o stream da IA
    reply.hijack();

    const result = streamText({
      model: googleProvider("gemini-3-flash-preview"),
      messages: [{ role: "user", content: promptMessage }],
    });

    result.pipeTextStreamToResponse(reply.raw, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
    });

    // DEPRECIADO
    // const stream = OpenAIProvider(response);

    // DEPRECIADO
    // o ".raw" retorna a referência da resposta interna nativa do Node (não passa pelo fastify)
    // é preciso fazer a configuração do Cors de forma manual
    // as configurações do fastify feitas em "routes.ts" não funcionam para respostas que não passam pelo fastify
    // o Cors é configurado pelo "headers"
    // streamText(stream, reply.raw, {
    //   headers: {
    //     "Access-Control-Allow-Origin": "*",
    //     "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    //   },
    // });
  });
}
