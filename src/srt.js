import React, { useState } from "react";
import Button from "./button";
import { Card } from "./card";
import { saveAs } from "file-saver";

const SRT_VTT = () => {
  const [files, setFiles] = useState([]); 
  const [fileTranslations, setFileTranslations] = useState([]); 

  const handleFileUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    if (uploadedFiles.length > 0) {
      const newFileTranslations = uploadedFiles.map((file) => ({
        file,
        languages: ["Spanish"], // Default language array (for example, Spanish)
        progress: [],
        translatedContent: [], // For each language's translated content
        loading: [], // Track if translation is in progress for each language
      }));
      setFiles((prevFiles) => [...prevFiles, ...uploadedFiles]);
      setFileTranslations((prev) => [...prev, ...newFileTranslations]);
    }
  };

  const parseSRT = (srtContent) => {
    const srtArray = [];
    const regex = /(\d{1,2}:\d{1,2}:\d{1,2},\d{3}) --> (\d{1,2}:\d{1,2}:\d{1,2},\d{3})\n([^\n]+)/g;
    let match;
    while ((match = regex.exec(srtContent)) !== null) {
      srtArray.push({
        startTime: match[1],
        endTime: match[2],
        text: match[3],
      });
    }
    return srtArray;
  };

  const parseVTT = (vttContent) => {
    const vttArray = [];
    const regex = /([\d:.]+) --> ([\d:.]+)\n([^\n]+)/g;
    let match;
    while ((match = regex.exec(vttContent)) !== null) {
      vttArray.push({
        startTime: match[1],
        endTime: match[2],
        text: match[3],
      });
    }
    return vttArray;
  };

  const convertToSRTFormat = (subtitles) => {
    return subtitles.map((sub) => {
      return `${sub.startTime} --> ${sub.endTime}\n${sub.text}\n`;
    }).join("\n");
  };

  const convertToVTTFormat = (subtitles) => {
    return `WEBVTT\n\n${subtitles
      .map((sub) => {
        return `${sub.startTime} --> ${sub.endTime}\n${sub.text}\n`;
      })
      .join("\n")}`;
  };

  const handleTranslate = async (fileIndex, languageIndex) => {
    const fileTranslation = fileTranslations[fileIndex];
    if (!fileTranslation || fileTranslation.loading[languageIndex] || !fileTranslation.file) return;

    const { file, languages } = fileTranslation;
    const language = languages[languageIndex];

    const updatedFileTranslations = [...fileTranslations];
    updatedFileTranslations[fileIndex].loading[languageIndex] = true;
    updatedFileTranslations[fileIndex].progress[languageIndex] = 0;
    setFileTranslations(updatedFileTranslations);

    try {
      const fileContent = await file.text();
      let parsedSubtitles = file.name.endsWith(".vtt")
        ? parseVTT(fileContent)
        : parseSRT(fileContent);

      const translatedSubtitles = [];
      const batchSize = 100;

      // Helper function to fetch translations for a batch
      const fetchBatchTranslations = async (batch) => {
        const requests = batch.map((subtitle) =>
          fetch("https://b8oyl0b1p9.execute-api.us-east-1.amazonaws.com/prod/api/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              text: subtitle.text,
              target_language: language,
            }),
          }).then((response) => {
            if (!response.ok) {
              throw new Error("Translation service is currently unavailable. Please try again later.");
            }
            return response.json();
          })
        );

        return Promise.all(requests);
      };

      let delayExecuted = false;

      // Process in batches
      for (let i = 0; i < parsedSubtitles.length; i += batchSize) {
        const batch = parsedSubtitles.slice(i, i + batchSize);

        if (i > 0 && !delayExecuted) {
          await new Promise((resolve) => setTimeout(resolve, 600)); 
          delayExecuted = true;
        }

        const responses = await fetchBatchTranslations(batch);

        responses.forEach((data, index) => {
          translatedSubtitles.push({
            ...batch[index],
            text: data.translation || batch[index].text,
          });
        });

        updatedFileTranslations[fileIndex].progress[languageIndex] = Math.floor(((i + batch.length) / parsedSubtitles.length) * 100);
        setFileTranslations([...updatedFileTranslations]);
      }

      const translatedContent =
        file.name.endsWith(".vtt")
          ? convertToVTTFormat(translatedSubtitles)
          : convertToSRTFormat(translatedSubtitles);

      updatedFileTranslations[fileIndex].translatedContent[languageIndex] = translatedContent;
      updatedFileTranslations[fileIndex].loading[languageIndex] = false;
      setFileTranslations(updatedFileTranslations);

    } catch (error) {
      console.error("Translation failed", error);
      updatedFileTranslations[fileIndex].loading[languageIndex] = false;
      updatedFileTranslations[fileIndex].progress[languageIndex] = 0;
      setFileTranslations(updatedFileTranslations);
    }
  };

  const handleDownload = (content, fileName) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, fileName);
  };

  return (
    <Card className="p-6 bg-gray-100 rounded-lg shadow-md mt-10 mb-10">
      <div className="space-y-4">
        {files.map((file, fileIndex) => (
          <div key={fileIndex} className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xl font-semibold text-gray-700">{file.name}</span>
              <Button
                onClick={() => {
                  setFiles(files.filter((f) => f !== file));
                  setFileTranslations(fileTranslations.filter((_, i) => i !== fileIndex));
                }}
                style={{ backgroundColor: '#e74c3c', color: 'white', borderRadius: '10px' }}
              >
                Remove
              </Button>
            </div>

            {/* Multi-Language Selector for Each File */}
            <div className="flex flex-col mb-4">
              <span>Select Languages</span>
              <div className="space-y-2">
                {["French", "German"].map((lang) => (
                  <label key={lang} className="inline-flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={fileTranslations[fileIndex].languages.includes(lang)}
                      onChange={(e) => {
                        const updatedLanguages = e.target.checked
                          ? [...fileTranslations[fileIndex].languages, lang]
                          : fileTranslations[fileIndex].languages.filter((l) => l !== lang);

                        const updatedFileTranslations = [...fileTranslations];
                        updatedFileTranslations[fileIndex].languages = updatedLanguages;
                        updatedFileTranslations[fileIndex].progress = new Array(updatedLanguages.length).fill(0);
                        updatedFileTranslations[fileIndex].loading = new Array(updatedLanguages.length).fill(false);
                        updatedFileTranslations[fileIndex].translatedContent = new Array(updatedLanguages.length).fill("");
                        setFileTranslations(updatedFileTranslations);
                      }}
                    />
                    <span>{lang.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Translate Button for Each Language */}
            {fileTranslations[fileIndex].languages.map((language, languageIndex) => (
              <div key={languageIndex} className="mt-4">
                <Button
                  onClick={() => handleTranslate(fileIndex, languageIndex)}
                  disabled={fileTranslations[fileIndex].loading[languageIndex]}
                  style={{ backgroundColor: '#3498db', color: 'white', padding: '8px 16px', borderRadius: '4px', width: '100%' }}
                >
                  {fileTranslations[fileIndex].loading[languageIndex] ? "Translating..." : `Translate to ${language.toUpperCase()}`}
                </Button>

                {/* Progress Bar for Each Language */}
                {fileTranslations[fileIndex].loading[languageIndex] && (
                  <div className="w-full mt-4">
                    <div className="h-2 bg-gray-300 rounded-full">
                      <div
                        className="h-2 bg-blue-500 rounded-full"
                        style={{ width: `${fileTranslations[fileIndex].progress[languageIndex]}%` }}
                      ></div>
                    </div>
                    <div className="text-center text-sm font-medium mt-1">{fileTranslations[fileIndex].progress[languageIndex]}%</div>
                  </div>
                )}

                {/* Download Button for Translated File */}
                {fileTranslations[fileIndex].translatedContent[languageIndex] && (
                  <Button
                    onClick={() =>
                      handleDownload(fileTranslations[fileIndex].translatedContent[languageIndex], `translated_${language}_${file.name}`)
                    }
                    style={{ backgroundColor: '#2ecc71', color: 'white', padding: '8px 16px', borderRadius: '4px', width: '100%' }}
                  >
                    Download {file.name} ({language.toUpperCase()})
                  </Button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <input
        type="file"
        accept=".srt,.vtt"
        onChange={handleFileUpload}
        style={{
          marginTop: '16px',
          padding: '8px',
          borderRadius: '4px',
          backgroundColor: 'blue',
          border: '1px solid #ccc',
          width: '100%',
        }}
        multiple
      />
    </Card>
  );
};

export default SRT_VTT;
