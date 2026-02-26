import { FastifyInstance } from "fastify";
import { fastifyMultipart } from "@fastify/multipart"
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream";
import { promisify } from "node:util";
import fs from 'node:fs'
import { prisma } from "../lib/prisma";

/* 
    o Node.js possui um recurso de "stream", que permite que os dados do arquivo sejam salvos em disco à medida que são enviados no back-end (em partes)
        isso evita que o arquivo seja armazenado na memória RAM até ser carregado por completo e só depois salvar em disco, o que pode ser muito pesado e impactaria na performance da aplicação
    para aguardar todo o upload, existe um recurso chamado "pipeline"
        o "pipeline" utiliza um "callback" (baseado em uma API mais antiga do Node.js) para sinalizar que o upload foi concluído, ou seja, ele não suporta promises (async/await)
            para transformar o "pipeline" em uma função que suporta promises, o Node.js possui uma "util" chamada "promisify"
*/
const pump = promisify(pipeline)

export async function uploadVideoRoute(app: FastifyInstance) {

    // envio de arquivo utilizando o fastify-multipart
    app.register(fastifyMultipart, {
        limits: {
            fileSize: 1_048_576 * 25, // 1048576 (1mb) é o valor padrão (os underlines servem apenas para ler melhor o número, ele não é alterado)

        }
    })

    app.post('/videos', async (request, reply) => {
        const data = await request.file()

        // mensagem de erro se nenhum arquivo foi enviado
        if (!data) {
            return reply.status(400).send({ error: 'Missing file input.' })
        }

        // se não entrar no if acima, então o arquivo existe
        
        // pegando a extensão do arquivo (.mp3, .mp4...)
        const extension = path.extname(data.filename)

        // apesar da rota ser de upload de vídeo,  o processo de transcrição do vídeo em áudio é feito no navegador, então aqui é recebido o áudio já convertido
        if (extension !== '.mp3') {
            return reply.status(400).send({ error: 'Invalid input. Please upload a MP3 file.'})
        }

        // pegando o nome do arquivo sem a extensão
        const fileBaseName = path.basename(data.filename, extension)
        
        // gerando um novo nome para o arquivo, para evitar nomes idênticos
        const fileUploadName = `${fileBaseName}-${randomUUID()}-${extension}`

        // criando uma variável para armazenar o arquivo
        const uploadDestination = path.resolve(__dirname, '../../tmp', fileUploadName)

        // armazenando o arquivo após ter sido carregado por completo (através da variável "pump")
        // "data.file" é um tipo "stream"
        // "fs.createWriteStream" salva o arquivo no destino
        await pump(data.file, fs.createWriteStream(uploadDestination))

        // registrando o upload no banco de dados
        const video = await prisma.video.create({
            data: {
                name: data.filename,
                path: uploadDestination,
            }
        })

        // para indicar que a requisição finalizou - retornando um objeto com os dados do arquivo enviado
        return {
            video
        }
    })
}