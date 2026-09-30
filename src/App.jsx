import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AudioLines, Search, Play, Pause, Download, UploadCloud, Music2, Headphones, ListMusic, LogIn, LogOut, X, Disc3, Eye, Plus, Trash2, UserRound, Radio } from 'lucide-react';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

const demoSongs = [
  { id:'demo-1', title:'Bohagote Kopou Phulile', artist:'Suvo Music', genre:'Assamese Bihu', cover_url:'', audio_url:'', views:1284, playlist:'Bihu Vibes', demo:true },
  { id:'demo-2', title:'Mujh Mein Tu, Tu Hi Tu Basa', artist:'Suvo Music', genre:'Hindi Romantic', cover_url:'', audio_url:'', views:964, playlist:'Love Notes', demo:true },
  { id:'demo-3', title:'Midnight Memories', artist:'Suvo Music', genre:'Indie', cover_url:'', audio_url:'', views:642, playlist:'Late Night', demo:true },
];
const pretty = n => new Intl.NumberFormat('en-IN').format(n || 0);
const initials = s => (s || 'SM').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();

export default function App() {
  const [songs,setSongs] = useState(demoSongs);
  const [search,setSearch] = useState('');
  const [active,setActive] = useState(null);
  const [playing,setPlaying] = useState(false);
  const [session,setSession] = useState(null);
  const [authOpen,setAuthOpen] = useState(false);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [authMode,setAuthMode] = useState('login');
  const [message,setMessage] = useState('');
  const [uploadOpen,setUploadOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [tab,setTab] = useState('Discover');
  const [playlist,setPlaylist] = useState('All Songs');
  const [profileName,setProfileName] = useState('Suvo Music');
  const [profileBio,setProfileBio] = useState('Independent sounds. Original stories. Made with heart.');
  const [upload,setUpload] = useState({title:'',artist:'Suvo Music',genre:'Assamese',playlist:'New Releases',audio:null,cover:null});
  const audioRef = useRef(null);
  const isConfigured = !!supabase;
  const isAdmin = !!session;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s)=>setSession(s));
    loadSongs();
    return ()=>subscription.unsubscribe();
  }, []);

  async function loadSongs() {
    if (!supabase) return;
    const {data,error} = await supabase.from('songs').select('*').order('created_at',{ascending:false});
    if (!error && data) setSongs(data);
  }

  useEffect(() => {
    if (!audioRef.current || !active?.audio_url) return;
    audioRef.current.src = active.audio_url;
    if (playing) audioRef.current.play().catch(()=>setPlaying(false));
  }, [active, playing]);

  const visibleSongs = useMemo(() => songs.filter(s => {
    const q = search.toLowerCase();
    const match = [s.title,s.artist,s.genre,s.playlist].some(v=>(v||'').toLowerCase().includes(q));
    return match && (playlist==='All Songs' || s.playlist===playlist);
  }),[songs,search,playlist]);

  async function togglePlay(song) {
    if (!song.audio_url) { setMessage('Demo preview only — connect Supabase and upload your MP3 to enable playback.'); return; }
    if (active?.id===song.id && playing) { audioRef.current?.pause(); setPlaying(false); return; }
    setActive(song); setPlaying(true);
    if (supabase && !String(song.id).startsWith('demo-')) {
      await supabase.rpc('increment_song_views',{song_id:song.id});
      setSongs(prev=>prev.map(s=>s.id===song.id?{...s,views:(s.views||0)+1}:s));
    }
  }

  async function authenticate(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    if (!supabase) { setMessage('First add your Supabase URL and anon key to .env.local.'); setBusy(false); return; }
    const result = authMode==='login'
      ? await supabase.auth.signInWithPassword({email,password})
      : await supabase.auth.signUp({email,password});
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else {
      if (authMode==='signup' && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
      else { setSession(result.data.session); setAuthOpen(false); setPassword(''); setMessage('Signed in.'); }
    }
  }

  async function submitSong(e) {
    e.preventDefault();
    if (!supabase || !session) { setMessage('Sign in to your admin account first.'); return; }
    if (!upload.audio) { setMessage('Choose an MP3 audio file.'); return; }
    setBusy(true); setMessage('');
    try {
      const safeName = `${crypto.randomUUID()}-${upload.audio.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`;
      const audioPath = `${session.user.id}/${safeName}`;
      const audioUp = await supabase.storage.from('songs').upload(audioPath,upload.audio,{contentType:'audio/mpeg',upsert:false});
      if (audioUp.error) throw audioUp.error;
      let coverPath = null, cover_url = null;
      if (upload.cover) {
        const coverName = `${crypto.randomUUID()}-${upload.cover.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`;
        coverPath = `${session.user.id}/${coverName}`;
        const coverUp = await supabase.storage.from('covers').upload(coverPath,upload.cover,{upsert:false});
        if (coverUp.error) throw coverUp.error;
        cover_url = supabase.storage.from('covers').getPublicUrl(coverPath).data.publicUrl;
      }
      const audio_url = supabase.storage.from('songs').getPublicUrl(audioPath).data.publicUrl;
      const {error} = await supabase.from('songs').insert({
        title:upload.title,artist:upload.artist,genre:upload.genre,playlist:upload.playlist,
        audio_url, audio_path:audioPath, cover_url, cover_path:coverPath, owner_id:session.user.id
      });
      if (error) throw error;
      setUploadOpen(false); setUpload({title:'',artist:'Suvo Music',genre:'Assamese',playlist:'New Releases',audio:null,cover:null});
      setMessage('Song uploaded successfully.'); await loadSongs();
    } catch(err) { setMessage(err.message || 'Upload failed.'); }
    finally { setBusy(false); }
  }

  async function deleteSong(song) {
    if (!supabase || !session || !confirm(`Delete "${song.title}"?`)) return;
    const {error} = await supabase.from('songs').delete().eq('id',song.id);
    if (error) { setMessage(error.message); return; }
    if (song.audio_path) await supabase.storage.from('songs').remove([song.audio_path]);
    if (song.cover_path) await supabase.storage.from('covers').remove([song.cover_path]);
    setSongs(prev=>prev.filter(s=>s.id!==song.id));
    if (active?.id===song.id) { setPlaying(false); setActive(null); }
  }

  const playlists = ['All Songs',...new Set(songs.map(s=>s.playlist).filter(Boolean))];
  const totalViews = songs.reduce((sum,s)=>sum+(s.views||0),0);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={()=>setTab('Discover')}><span className="brand-icon"><AudioLines size={24}/></span><span>suvo<span className="brand-light">music</span><small>YOUR SOUND. YOUR STORY.</small></span></a>
      <div className="nav-label">MENU</div>
      {[[ 'Discover',Radio],['My Playlists',ListMusic],['Artist Profile',UserRound]].map(([name,Icon])=><button key={name} className={`nav-item ${tab===name?'selected':''}`} onClick={()=>setTab(name)}><Icon size={18}/>{name}</button>)}
      <div className="nav-label playlist-label">YOUR LIBRARY <button className="tiny-icon" onClick={()=>setPlaylist('All Songs')}><Plus size={15}/></button></div>
      {playlists.map(p=><button key={p} className={`playlist-link ${playlist===p?'playlist-active':''}`} onClick={()=>{setPlaylist(p);setTab('Discover')}}><span className="playlist-dot"/>{p}</button>)}
      <div className="sidebar-bottom"><div className="mini-profile"><div className="avatar">{initials(profileName)}</div><div><strong>{profileName}</strong><small>Independent Artist</small></div></div><div className="side-note"><span className="pulse"/> Music for every mood</div></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs">Suvo Music <span>/</span> <b>{tab}</b></div>
        <div className="top-actions"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search songs, artists..."/><kbd>⌘ K</kbd></label>
          {isAdmin ? <button className="outline-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sign out</button> : <button className="outline-btn" onClick={()=>{setAuthOpen(true);setAuthMode('login')}}><LogIn size={16}/> Admin login</button>}
          {isAdmin&&<button className="primary-btn" onClick={()=>setUploadOpen(true)}><UploadCloud size={17}/> Upload song</button>}
        </div>
      </header>

      {message&&<div className="toast" role="status">{message}<button onClick={()=>setMessage('')}><X size={15}/></button></div>}

      {tab==='Artist Profile' ? <section className="profile-page">
        <div className="profile-cover"><div className="profile-orb orb-one"/><div className="profile-orb orb-two"/><span className="eyebrow">INDEPENDENT ARTIST</span><h1>{profileName}</h1><p>Original music, made for your moments.</p></div>
        <div className="profile-edit"><div className="avatar big">{initials(profileName)}</div><div className="profile-fields"><label>Artist name<input value={profileName} onChange={e=>setProfileName(e.target.value)}/></label><label>Artist bio<textarea value={profileBio} onChange={e=>setProfileBio(e.target.value)}/></label><p className="muted">Profile edits in this starter are preview-only; database profile saving can be added next.</p></div></div>
        <div className="stats-grid"><Stat icon={Music2} label="Songs published" value={songs.filter(s=>!s.demo).length}/><Stat icon={Eye} label="Total plays" value={pretty(totalViews)}/><Stat icon={ListMusic} label="Playlists" value={playlists.length-1}/></div>
      </section> : tab==='My Playlists' ? <section className="content-section"><SectionHeading eyebrow="COLLECTIONS" title="Your playlists" desc="Pick a collection to explore its sound."/><div className="playlist-grid">{playlists.filter(p=>p!=='All Songs').map((p,i)=><button className="playlist-card" key={p} onClick={()=>{setPlaylist(p);setTab('Discover')}}><div className={`playlist-art art-${i%4}`}><Disc3 size={42}/></div><span className="eyebrow">PLAYLIST</span><strong>{p}</strong><small>{songs.filter(s=>s.playlist===p).length} tracks</small></button>)}</div></section> : <>
        <section className="hero">
          <div className="hero-content"><span className="eyebrow"><span className="live-dot"/> THE SOUND OF INDEPENDENCE</span><h1>Every song has<br/>a <em>story.</em></h1><p>Discover original sounds, find your next favourite, and take the music with you.</p><div className="hero-actions"><button className="primary-btn large" onClick={()=>document.getElementById('track-list')?.scrollIntoView({behavior:'smooth'})}><Play size={17} fill="currentColor"/> Explore music</button><span className="hero-caption"><Headphones size={16}/> Stream freely. Download anytime.</span></div></div>
          <div className="hero-art"><div className="hero-ring ring-one"/><div className="hero-ring ring-two"/><div className="hero-disc"><div className="disc-label"><AudioLines size={42}/><span>SUVO<br/>MUSIC</span></div></div><div className="floating-tag tag-top"><span className="equalizer"><i/><i/><i/><i/></span> ORIGINAL SOUNDS</div><div className="floating-tag tag-bottom"><span className="tiny-cover"><Music2 size={16}/></span><span><b>Made for you</b><small>Independent music</small></span></div></div>
        </section>
        <section className="stats-grid compact-stats"><Stat icon={Music2} label="Tracks" value={songs.length}/><Stat icon={Eye} label="Total plays" value={pretty(totalViews)}/><Stat icon={ListMusic} label="Playlists" value={playlists.length-1}/></section>
        <section className="content-section" id="track-list"><div className="section-top"><SectionHeading eyebrow="HANDPICKED FOR YOU" title={playlist==='All Songs'?'Explore music':playlist} desc="Original tracks from the Suvo Music library."/><button className="text-btn" onClick={()=>{setPlaylist('All Songs');setSearch('')}}>View all <span>↗</span></button></div>
          <div className="track-table"><div className="table-head"><span>#</span><span>TRACK</span><span>GENRE</span><span>PLAYS</span><span>ACTION</span></div>
          {visibleSongs.map((song,i)=><div className={`track-row ${active?.id===song.id?'current-track':''}`} key={song.id}><span className="track-index">{active?.id===song.id&&playing?<span className="equalizer"><i/><i/><i/></span>:String(i+1).padStart(2,'0')}</span><div className="track-info"><button className="cover-button" onClick={()=>togglePlay(song)}>{song.cover_url?<img src={song.cover_url} alt=""/>:<span className={`cover-placeholder cover-${i%5}`}><Music2 size={23}/></span>}<span className="cover-play">{active?.id===song.id&&playing?<Pause size={16}/>:<Play size={16} fill="currentColor"/>}</span></button><div className="track-text"><strong>{song.title}</strong><small>{song.artist}</small></div></div><span className="genre-pill">{song.genre||'Independent'}</span><span className="play-count"><Eye size={14}/>{pretty(song.views)}</span><div className="track-actions"><button title="Play" onClick={()=>togglePlay(song)} className="icon-btn">{active?.id===song.id&&playing?<Pause size={17}/>:<Play size={17}/>}</button>{song.audio_url&&<a title="Download MP3" className="icon-btn" href={song.audio_url} download><Download size={17}/></a>}{isAdmin&&!song.demo&&<button title="Delete song" className="icon-btn danger" onClick={()=>deleteSong(song)}><Trash2 size={16}/></button>}</div></div>)}
          {!visibleSongs.length&&<div className="empty-state"><Search size={26}/><b>No tracks found</b><span>Try another search or playlist.</span></div>}
          </div>
          {songs.some(s=>s.demo)&&<p className="demo-note">Preview content is illustrative. Connect Supabase and upload your original MP3s to publish real playable tracks.</p>}
        </section>
      </>}

      <footer><div className="footer-brand"><AudioLines size={18}/> <b>suvo<span>music</span></b></div><span>Independent music. Open ears.</span><span>© {new Date().getFullYear()} Suvo Music</span></footer>
    </main>

    <div className="player-bar">
      <div className="now-playing"><div className="now-cover">{active?.cover_url?<img src={active.cover_url} alt=""/>:<Music2 size={20}/>}</div><div><strong>{active?.title||'Choose a track'}</strong><small>{active?.artist||'Suvo Music'}</small></div></div>
      <div className="player-controls"><button className="play-main" onClick={()=>active&&togglePlay(active)} disabled={!active?.audio_url}>{playing?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}</button><div className="player-progress"><span>{playing?'NOW PLAYING':'READY WHEN YOU ARE'}</span><div className={`progress-line ${playing?'animated':''}`}><i/></div></div></div>
      <div className="player-extra"><AudioLines size={19}/><span>HQ AUDIO</span></div>
      <audio ref={audioRef} onEnded={()=>setPlaying(false)} onError={()=>setPlaying(false)} />
    </div>

    {authOpen&&<Modal title="Admin access" close={()=>setAuthOpen(false)}><p className="modal-sub">Sign in to manage your music library.</p><form onSubmit={authenticate} className="modal-form"><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={authMode==='login'?'current-password':'new-password'} placeholder="At least 8 characters"/></label>{message&&<p className="form-message">{message}</p>}<button className="primary-btn full" disabled={busy}>{busy?'Please wait…':authMode==='login'?'Sign in securely':'Create account'}</button><button type="button" className="switch-auth" onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setMessage('')}}>{authMode==='login'?'Need an account? Create one':'Already registered? Sign in'}</button><p className="security-note">Admin access is enforced by Supabase Auth and database/storage policies. Public visitors cannot upload songs.</p></form></Modal>}
    {uploadOpen&&<Modal title="Upload a new track" close={()=>setUploadOpen(false)}><p className="modal-sub">Publish your original music to the public library.</p><form className="modal-form" onSubmit={submitSong}><label>Song title<input value={upload.title} onChange={e=>setUpload({...upload,title:e.target.value})} required maxLength={120} placeholder="Track title"/></label><label>Artist name<input value={upload.artist} onChange={e=>setUpload({...upload,artist:e.target.value})} required maxLength={100}/></label><div className="form-two"><label>Genre<input value={upload.genre} onChange={e=>setUpload({...upload,genre:e.target.value})} placeholder="Assamese Bihu"/></label><label>Playlist<input value={upload.playlist} onChange={e=>setUpload({...upload,playlist:e.target.value})} required placeholder="New Releases"/></label></div><label className="file-pick"><UploadCloud size={20}/><span><b>{upload.audio?.name||'Choose MP3 audio'}</b><small>MP3 format, max 20 MB in this starter</small></span><input type="file" accept="audio/mpeg,.mp3" required onChange={e=>{const f=e.target.files?.[0];if(f&&f.size>20*1024*1024){setMessage('MP3 must be 20 MB or smaller.');e.target.value='';return;}setUpload({...upload,audio:f||null})}}/></label><label className="file-pick"><Music2 size={20}/><span><b>{upload.cover?.name||'Add cover artwork (optional)'}</b><small>JPG, PNG or WebP</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setUpload({...upload,cover:e.target.files?.[0]||null})}/></label>{message&&<p className="form-message">{message}</p>}<button className="primary-btn full" disabled={busy}>{busy?'Uploading…':'Publish song'}</button></form></Modal>}
  </div>;
}

function Stat({icon:Icon,label,value}) { return <div className="stat-card"><span className="stat-icon"><Icon size={17}/></span><div><small>{label}</small><strong>{value}</strong></div></div>; }
function SectionHeading({eyebrow,title,desc}) { return <div className="section-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{desc}</p></div>; }
function Modal({title,close,children}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal"><div className="modal-heading"><h2>{title}</h2><button className="icon-btn" onClick={close}><X size={18}/></button></div>{children}</div></div>; }