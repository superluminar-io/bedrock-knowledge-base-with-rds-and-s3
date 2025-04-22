import {
    BedrockAgentRuntime,
    InvokeAgentCommand,
    ResponseStream,
    RetrievedReference
} from '@aws-sdk/client-bedrock-agent-runtime';

const agentRuntime = new BedrockAgentRuntime();

type Event = { question: string }

function referencesToLinks(retrievedReferences: RetrievedReference[]) {
    const references: Record<string, string> = {};

    retrievedReferences.forEach((reference) => {
        if (!reference || !reference.location) {
            return;
        }

        switch (reference.location.type) {
            case 'S3':
                const s3Url: string = reference.location.s3Location!.uri as string;
                references[s3Url] = s3Url;
                break;
        }
        return;
    });

    return references;
}

export const handler = async ({ question }: Event) => {
    const { BEDROCK_AGENT_ID, BEDROCK_AGENT_ALIAS_ID } = process.env;

    const response = await agentRuntime.send(new InvokeAgentCommand({
        agentId: BEDROCK_AGENT_ID,
        agentAliasId: BEDROCK_AGENT_ALIAS_ID,
        inputText: question,
        sessionId: 'test',
    }))

    const completion = response.completion as AsyncIterable<ResponseStream>;

    const chunks = [];
    const references = [];

    for await (const { chunk } of completion) {
        const retrievedReferences = chunk?.attribution?.citations?.flatMap(({ retrievedReferences }) => retrievedReferences) || [];

        chunks.push(new TextDecoder().decode(chunk!.bytes));
        references.push(...retrievedReferences);
    }

    return {
        question: question,
        response: chunks.join(''),
        references: referencesToLinks(references as RetrievedReference[])
    };
};