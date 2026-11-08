import {parseTranscript} from './sigaa.js';

/** PDF bytes stay in this browser. The parser and worker are hosted with Affix. */
export async function readTranscriptPDF(file,onProgress=()=>{}) {
 if(file.size>10_000_000)throw Error('O histórico deve ter no máximo 10 MB.');
 const data=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw Error('Selecione um arquivo PDF válido.');
 const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
 const task=pdfjs.getDocument({data,isEvalSupported:false,useSystemFonts:true});
 try{
  const pdf=await task.promise;
  if(pdf.numPages>50)throw Error('O histórico deve ter no máximo 50 páginas.');
  const pages=[];
  for(let n=1;n<=pdf.numPages;n++){
   onProgress(n,pdf.numPages);
   const page=await pdf.getPage(n);
   const {items}=await page.getTextContent();
   pages.push({width:page.getViewport({scale:1}).width,items});
   page.cleanup();
  }
  return parseTranscript(pages);
 }catch(error){
  if(error.name==='PasswordException'||error.message?.includes('destroyed'))throw Error('O PDF está protegido por senha. Exporte um histórico sem senha no SIGAA.');
  if(error.name==='InvalidPDFException')throw Error('O PDF está inválido ou incompleto. Baixe o histórico novamente no SIGAA.');
  throw error;
 }finally{await task.destroy();}
}
