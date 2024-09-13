/**
 * parse.ts
 * Will handle running rag and parsing their data to timestamps.
 */

// for lecture 1
export const timestamps = ["0:30", "1:18", "2:10", "3:41", "4:40", "7:01", "8:48", "12:47", "14:34", "15:53", "17:27", "20:00", "20:35", "21:35", "22:17", "22:51", "23:50", "24:49", "27:04", "28:22", "29:24", "31:00", "32:00", "32:35", "34:20", "34:30", "35:30", "36:37", "37:56", "39:25", "39:53", "42:47"]
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";


export const init = async () => {
    const loader = new TextLoader("src/document_loaders/example_data/example.txt");
    const docs = await loader.load();

    // should create the chroma instance and do other jobs
    // const splitter = new RecursiveCharacterTextSplitter({
    //     chunkSize: 1000,
    //     chunkOverlap: 200,
    // });

    // const all_splits = splitter.splitDocuments()

}

// should return the timestamp of where to look, as well as a wriiten response
export const query = async (question: string): Promise<{ timestamp: string, response: string }> => {
    // this will use chroma. So we query to find the most relevant document, which has the id of the timestamp
    // then we run the rag chain on that document, to give the user a response.



    return { timestamp: "0:30", response: "This is the response to the question" }
}