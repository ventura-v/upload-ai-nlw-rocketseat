import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

// criando o tipo Status para cada etapa do upload
// waiting: quando o vídeo ainda não foi selecionado
// converting: convertendo de video para audio
// generating: gerando a transcrição do audio
// success: transcrição feita
type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'

const statusMessage = {
    converting: 'Convertendo...',
    generating: 'Transcrevendo...',
    uploading: 'Carregando...',
    success: 'Sucesso!'
}

interface videoInputProps {
    onVideoUploaded: (id: string) => void
}

export function VideoInputForm(props: videoInputProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [status, setStatus] = useState<Status>('waiting')

    // criando uma ref do prompt para poder acessar os métodos do elemento "textarea" na DOM
    const promptInputRef = useRef<HTMLTextAreaElement>(null)

    // função que será chamado quando o usuário adicionar algum vídeo
    // para saber como tipar o "event" (colocar a interface), basta passar o mouse em cima do método "onChange" e ver qual é o tipo esperado
    const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
        const { files } = event.currentTarget

        if (!files) {
            return
        }

        // como o input não está com o atributo de permitir a seleção de múltiplos itens para fazer o upload, basta pegar o primeiro elemento
        const selectedFile = files[0]

        setVideoFile(selectedFile)
    }

    const convertVideoToAudio = async (video: File) => {
        console.log('Convert started...')

        // carregando o ffmpeg (como é uma Promise, precisa do await, logo a função precisa do async)
        const ffmpeg = await getFFmpeg()

        // enviando o video para o contexto do ffmpeg
            // o ffmpeg não consegue acessar o arquivo na pasta do projeto
            // o envio é feito usando o fetchFile, que converte o video em uma representação binária do arquivo
        await ffmpeg.writeFile('input.mp4', await fetchFile(video))

        // descomentar se der algum erro
        // ffmpeg.on('log', log => {
        //     console.log(log)
        // })

        // verificar o progresso do envio do vídeo
        ffmpeg.on('progress', progress => {
            console.log(`Convert progress: ${Math.round(progress.progress * 100)}`)
        })

        // convertendo o video em audio
        // cada linha do array é concatenada, formando um comando único
        await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:a',
            '-b:a',
            '20k',
            '-acodec',
            'libmp3lame',
            'output.mp3'
        ])

        // ler o arquivo convertido "output.mp3"
        // o tipo de "data" será "FileData", um tipo próprio do ffmpeg
        const data = await ffmpeg.readFile('output.mp3')

        // para conseguir usar o arquivo ".mp3" no JavaScript
            // primeiro precisa converter o "data" de FileData para Blob
            // depois converter de Blob para File (próprio do JavaScript)
        const audioFileBlob = new Blob([data], { type: 'audio/mpeg'})
        const audioFile = new File([audioFileBlob], 'audio.mp3', {
            type: 'audio/mpeg',
        })
        
        console.log('Convert finished!')

        return audioFile
    }

    const handleUploadVideo = async (event: FormEvent<HTMLFormElement>) => {
        // sempre que é feito um submit em um form, a página é recarregada
        event.preventDefault()

        // acessando a versão do "textarea" na DOM através do "useRef", para pegar o valor o input
        const prompt = promptInputRef.current?.value

        // evitando que o usuário faça um submit sem ter feito o upload do vídeo
        if (!videoFile) {
            return
        }

        // converter o video em audio no browser do usuário
        setStatus('converting')
        const audioFile = await convertVideoToAudio(videoFile)

        /* upload do arquivo convertido para o back-end
        o Content-Type do método POST no back-end é "multipart/form-data" (ver "@name upload" em "routes.http") */
        // criando uma instância do tipo FormData
        const data = new FormData()
        // criando o campo do FormData, passando o nome do campo ("file") e o value ("audioFile") 
        // o nome do campo aparece em Content-Disposition: form-data; name="file" (ver "@name upload" em "routes.http")
        data.append('file', audioFile)
        setStatus('uploading')
        // finalmente, fazer o upload
        const response = await api.post('/videos', data)

        /* gerando a transcrição do vídeo */
        const videoId = response.data.video.id
        setStatus('generating')
        // a rota para o envio da transcrição com o prompt digitado pelo usuário (ver "@name create-transcription" em "routes.http")
        await api.post(`/videos/${videoId}/transcription`, {
            prompt,
        })

        setStatus('success')

        props.onVideoUploaded(videoId)
    }

    // useMemo para que a variável só seja renderizada caso a dependência for alterada, neste caso, o "videoFile"
    // o React renderiza todo o componente quando algo é alterado
        // o useMemo evita este comportamento
            // reduz o custo computacional e melhora a performance
    const previewUrl = useMemo(() => {
        if (!videoFile) {
            return null
        }

        return URL.createObjectURL(videoFile)
    }, [videoFile])

    return (
        <form onSubmit={handleUploadVideo} className="space-y-6">
            <label 
                htmlFor="video"
                className="relative border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/5"
            >
                {previewUrl ? (
                    <video src={previewUrl} controls={false} className="pointer-events-none absolute inset-0" />
                ) : (
                    <>
                        <FileVideo className="w-4 h-4" />
                        Selecione um vídeo
                    </>
                )}
                
            </label>

            <input type="file" id="video" accept="video/mp4" className="sr-only" onChange={handleFileSelected}/>

            <Separator />

            <div className="space-y-2">
                <Label htmlFor="transcription_prompt">Prompt da transcrição</Label>
                <Textarea
                    ref={promptInputRef}
                    id="transcription_prompt"
                    className="h-20 leading-relaxed resize-none"
                    placeholder="Inclua palavras-chave mencionadas no vídeo separadas por vírgula (,)"
                    disabled={status !== 'waiting'}
                />
            </div>

            <Button
                type="submit"
                disabled={status !== 'waiting'}
                data-success={status === 'success'} // criando uma tag data-, onde ele será true quando status === 'success' 
                className="w-full data-[success=true]:bg-emerald-400" // aplicando a estilização quando tag data-success for true
            >
                { status === 'waiting' ? (
                    <>
                        Carregar vídeo
                        <Upload className="w-4 h-4 ml-2"/>
                    </>
                ) : statusMessage[status]}
                
            </Button>
        </form>
    )
}