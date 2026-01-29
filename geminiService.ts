
import { GoogleGenAI, Type } from "@google/genai";
import { StructuredDocument } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function analyzePdfPages(pageImages: string[]): Promise<StructuredDocument> {
  const model = 'gemini-3-flash-preview';
  
  const prompt = `
    Analyze these images of a PDF document. 
    Your task is to provide a 1:1 reconstruction of the content.
    Extract all text, headings, lists, and tables EXACTLY as they appear. 
    DO NOT add any titles, summaries, dates, or metadata that are not explicitly written in the document.
    Maintain the exact logical flow and structural order.
    Return the result as a structured JSON containing only the elements found.
  `;

  const imageParts = pageImages.map(img => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: img.split(',')[1],
    },
  }));

  const response = await ai.models.generateContent({
    model: model,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          elements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { 
                  type: Type.STRING, 
                  description: "One of: paragraph, heading1, heading2, list_item, table" 
                },
                text: { type: Type.STRING },
                rows: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  description: "Used only for table type"
                }
              },
              required: ["type"]
            }
          }
        },
        required: ["elements"]
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as StructuredDocument;
}
