// 28 · Progressive stadium sound, synthesised with Web Audio (no sound files): a crowd bed that swells with
// danger, the late minutes of a close match and special fixtures; a roar for goals, an "ooh" for near misses,
// a groan for goals conceded and the referee's whistle.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Crowd intensity between 0 and 1 for the current situation.
export function crowdLevel(c={}){let level=.2+clamp(c.minute||0,0,90)/90*.1;
 level+=clamp(c.danger||0,0,1)*.3;if(c.chance)level+=.12;
 const diff=(c.us||0)-(c.them||0);if((c.minute||0)>=75&&Math.abs(diff)<=1)level+=.12;
 if(c.scenario==='derby')level+=.1;else if(c.scenario==='remontada'&&diff<0)level+=.08;else if(c.scenario==='finale')level+=.06;
 if(c.trailingLate&&diff<0)level+=.05;return clamp(level,0,.95);}
export class Ambience{
 constructor(){this.ctx=null;this.enabled=true;this.level=0;}
 get available(){return !!(globalThis.AudioContext||globalThis.webkitAudioContext);}
 // Must be called from a tap: phones only allow sound after the player touches the screen.
 start(){if(!this.enabled||!this.available)return false;try{if(!this.ctx)this.build();this.ctx.resume?.();this.setLevel(.2,.4);return true;}catch(e){this.ctx=null;return false;}}
 build(){const A=globalThis.AudioContext||globalThis.webkitAudioContext,ctx=this.ctx=new A(),rate=ctx.sampleRate||44100,len=rate*2,buffer=ctx.createBuffer(1,len,rate),data=buffer.getChannelData(0);
  // Pink-ish noise: the murmur of thousands of voices.
  let b0=0,b1=0,b2=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;b0=.997*b0+w*.029;b1=.985*b1+w*.032;b2=.95*b2+w*.048;data[i]=(b0+b1+b2+w*.02)*.9;}
  const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
  this.voice=ctx.createBiquadFilter();this.voice.type='bandpass';this.voice.frequency.value=700;this.voice.Q.value=.6;
  this.rumble=ctx.createBiquadFilter();this.rumble.type='lowpass';this.rumble.frequency.value=260;
  this.master=ctx.createGain();this.master.gain.value=0;this.bed=ctx.createGain();this.bed.gain.value=.5;this.low=ctx.createGain();this.low.gain.value=.35;
  source.connect(this.voice);this.voice.connect(this.bed);source.connect(this.rumble);this.rumble.connect(this.low);this.bed.connect(this.master);this.low.connect(this.master);this.master.connect(ctx.destination);source.start?.();this.source=source;}
 // The bed follows the level slowly, so the noise builds up rather than jumping.
 setLevel(level,smooth=1.2){this.level=level;if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime;if(t<(this.busyUntil||0))return;this.master.gain.setTargetAtTime(.05+level*.5,t,smooth);this.voice.frequency.setTargetAtTime(550+level*700,t,smooth);}
 swell(peak,attack,hold,release,freq){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime,g=this.master.gain;this.busyUntil=t+attack*3+hold+release;g.cancelScheduledValues?.(t);g.setTargetAtTime(peak,t,attack);g.setTargetAtTime(.05+this.level*.5,t+attack*3+hold,release);if(freq){this.voice.frequency.setTargetAtTime(freq,t,attack);this.voice.frequency.setTargetAtTime(550+this.level*700,t+attack*3+hold,release);}}
 goal(){this.swell(.95,.08,2.2,1.4,1500);this.whistle(1);}
 ooh(){this.swell(.7,.15,.5,.8,480);}
 groan(){this.swell(.32,.2,.6,1.2,350);}
 whistle(count=1){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime+.05;for(let k=0;k<count;k++){const o=this.ctx.createOscillator(),g=this.ctx.createGain(),start=t+k*.45,len=k===count-1&&count>1?.75:.32;o.type='square';o.frequency.value=2900;const trill=this.ctx.createOscillator(),depth=this.ctx.createGain();trill.frequency.value=38;depth.gain.value=160;trill.connect(depth);depth.connect(o.frequency);g.gain.value=0;g.gain.setTargetAtTime(.06,start,.01);g.gain.setTargetAtTime(0,start+len,.03);o.connect(g);g.connect(this.ctx.destination);o.start(start);trill.start(start);o.stop(start+len+.2);trill.stop(start+len+.2);}}
 stop(){if(!this.ctx)return;const t=this.ctx.currentTime;this.master.gain.setTargetAtTime(0,t,.5);}
 setEnabled(on){this.enabled=!!on;if(!on&&this.ctx){this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.1);}}
}
