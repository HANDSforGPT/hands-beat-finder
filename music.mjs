// Local, dependency-free chroma key estimator. Key results are approximations.
const MAJOR=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}for(let s=2;s<=n;s*=2){const a=-2*Math.PI/s,wR=Math.cos(a),wI=Math.sin(a);for(let st=0;st<n;st+=s){let wr=1,wi=0;for(let k=0;k<s/2;k++){const even=st+k,odd=even+s/2,tr=wr*re[odd]-wi*im[odd],ti=wr*im[odd]+wi*re[odd];re[odd]=re[even]-tr;im[odd]=im[even]-ti;re[even]+=tr;im[even]+=ti;[wr,wi]=[wr*wR-wi*wI,wr*wI+wi*wR]}}}}
function similarity(a,b){let dot=0,aa=0,bb=0;for(let i=0;i<12;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return dot/Math.sqrt(aa*bb||1)}
export function estimateKey(samples,rate=11025){const size=4096,hop=2048,total=new Float64Array(12);const window=Float64Array.from({length:size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(size-1)));let frames=0;
for(let start=0;start+size<samples.length&&frames<250;start+=hop){const re=new Float64Array(size),im=new Float64Array(size);let power=0;for(let i=0;i<size;i++){const v=samples[start+i]/32768;power+=v*v;re[i]=v*window[i]}if(power/size<.00001)continue;fft(re,im);const local=new Float64Array(12);
for(let j=28;j<size/2;j++){const hz=j*rate/size;if(hz<80||hz>2400)continue;const note=69+12*Math.log2(hz/440),nearest=Math.round(note);if(Math.abs(note-nearest)>.24)continue;const mag=Math.hypot(re[j],im[j]);local[(nearest%12+12)%12]+=Math.sqrt(mag)/Math.sqrt(hz/160)}
const sum=local.reduce((a,b)=>a+b,0);if(sum<.01)continue;for(let k=0;k<12;k++)total[k]+=local[k]/sum;frames++}
if(!frames)return {key:'Unknown',confidence:'low',alternatives:[],score:0,frames:0};
const chroma=Array.from(total,x=>x/frames),results=[];
for(let root=0;root<12;root++)for(const [mode,profile] of [['major',MAJOR],['minor',MINOR]]){const shifted=Array.from({length:12},(_,i)=>profile[(i-root+12)%12]);results.push({key:NAMES[root]+' '+mode,score:similarity(chroma,shifted)})}
results.sort((a,b)=>b.score-a.score);
const margin=results[0].score-results[1].score;
return {key:results[0].key,confidence:margin>.075?'moderate':'low',alternatives:results.slice(1,4).map(x=>x.key),score:+results[0].score.toFixed(2),frames,note:'This is an approximate harmonic estimate; relative major/minor and complex songs may be ambiguous.'}}
