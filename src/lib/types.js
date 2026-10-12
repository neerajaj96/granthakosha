/** GranthaKosha core types (JSDoc). All text stored EXACTLY — never normalized. */

/**
 * @typedef {string} ID
 * @typedef {{id:ID,title:string,subtitle?:string,language?:string,createdAt:number,updatedAt:number}} Scripture
 * @typedef {{id:ID,scriptureId:ID,ordinal:number,section?:string,mula:string,en?:string,primaryEn?:string,createdAt:number,updatedAt:number}} Passage
 * @typedef {{id:ID,passageId:ID,author:string,title?:string,text:string,simpleEn?:string,createdAt:number,updatedAt:number}} Commentary
 * @typedef {{version:1,exportedAt:number,scriptures:Scripture[],passages:Passage[],commentaries:Commentary[]}} ExportDoc
 * @typedef {{addedPassages:number,skippedDuplicates:number,addedCommentaries:number,skippedCommentaryDuplicates:number,errors:string[]}} ImportReport
 */

export {};
