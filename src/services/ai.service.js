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

const reviewProjectCode = async (files) => {
    const prompt = `
You are an experienced software engineer performing a code review.

Review the following project source code.

Return ONLY valid JSON using exactly this structure:

{
    "overallScore": 0,
    "summary": "",
    "codeQuality": [],
    "bugs": [],
    "security": [],
    "performance": [],
    "maintainability": [],
    "recommendations": []
}

Rules:

- overallScore must be an integer from 0 to 100.
- Identify realistic issues from the provided code.
- Do not invent files or functionality that are not provided.
- Security findings should be specific.
- Performance findings should be specific.
- Recommendations must be actionable.
- Keep the review suitable for a developer portfolio project.
- Return valid JSON only.
- Do not use markdown.

SOURCE FILES:

${files.map(file => `
FILE: ${file.path}

${file.content}
`).join("\n")}
`;

    return generateAIResponse(prompt);
};


module.exports = {
    generateAIResponse,
    analyzeProject,
    reviewProjectCode
};