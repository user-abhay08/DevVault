const {GoogleGenAI} = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const generateAIResponse = async (prompt)=>{
    console.log("GEMINI: Request started");
    const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
        config: {
            responseMimeType: "application/json"
        }
    });
    console.log("GEMINI: Response received");
    try{
    return JSON.parse(response.text);
    } catch(error){
        console.error("AI JSON PARSE ERROR", response.text);
        throw new Error("AI returned invalid JSON");
    }
};

const analyzeProject = async (projectData) => {
   const prompt = `
You are an expert software engineering mentor.

...

Contributors:
${JSON.stringify(projectData.contributors)}

Return the analysis as valid JSON using exactly this structure:

{
  "projectScore": 0,
  "projectOverview": "",
  "technologies": [],
  "strengths": [],
  "weaknesses": [],
  "recommendations": [],
  "nextSteps": []
}

Requirements:

- projectScore must be a number from 0 to 100.
- projectOverview must briefly explain the project.
- technologies must contain the main technologies identified from the project data.
- strengths must contain practical strengths of the project.
- weaknesses must contain practical weaknesses or limitations.
- recommendations must contain specific actionable improvements.
- nextSteps must contain practical steps the developer should take next.
- Return ONLY valid JSON.
- Do not use Markdown.
- Do not add \`\`\`json or any text outside the JSON.
`;
    return await generateAIResponse(prompt);
};


module.exports = {
    generateAIResponse,
    analyzeProject
};