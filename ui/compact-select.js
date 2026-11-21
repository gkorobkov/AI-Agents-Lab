// Adapt native selects to the shared compact menu without changing their state/events.
(() => {
  let active;
  function attach(select, {label}) {
    const host=document.createElement('span');host.className='compact-select';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='compact-select-trigger';
    trigger.id=select.id+'-trigger';trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
    const caption=document.createElement('span');
    trigger.append(caption);
    trigger.insertAdjacentHTML('beforeend','<svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m1 1 4 4 4-4"/></svg>');
    const menu=document.createElement('div');menu.id=select.id+'-menu';menu.className='compact-select-menu compact-select-popup';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',label);menu.hidden=true;
    trigger.setAttribute('aria-controls',menu.id);
    select.after(host);host.append(trigger);document.body.append(menu);select.hidden=true;
    function close(focus=false){host.classList.remove('open');trigger.setAttribute('aria-expanded','false');menu.hidden=true;if(active?.host===host)active=null;if(focus)trigger.focus();}
    function sync(){caption.textContent=select.selectedOptions[0]?.textContent||'';trigger.title=caption.textContent;trigger.disabled=select.disabled;host.dataset.value=select.value;}
    function open(last=false){
      active?.close();sync();menu.replaceChildren();
      for(const option of select.options){
        const item=document.createElement('button');item.type='button';item.className='compact-select-option';item.textContent=option.textContent;item.disabled=option.disabled;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));
        item.addEventListener('click',event=>{event.preventDefault();select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close(true);});menu.append(item);
      }
      host.classList.add('open');trigger.setAttribute('aria-expanded','true');menu.hidden=false;active={host,menu,close};
      const rect=trigger.getBoundingClientRect(),margin=8,width=Math.min(Math.max(rect.width,menu.scrollWidth),innerWidth-margin*2);
      menu.style.width=width+'px';menu.style.left=Math.max(margin,Math.min(rect.left,innerWidth-width-margin))+'px';
      const below=innerHeight-rect.bottom-margin,above=rect.top-margin,up=below<menu.scrollHeight&&above>below;
      menu.style.maxHeight=Math.max(0,up?above:below)+'px';menu.style.top=(up?Math.max(margin,rect.top-menu.offsetHeight-5):rect.bottom+5)+'px';
      const options=[...menu.querySelectorAll('button:not(:disabled)')];(last?options.at(-1):menu.querySelector('[aria-selected="true"]:not(:disabled)')||options[0])?.focus();
    }
    trigger.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();menu.hidden?open():close();});
    trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open(event.key==='ArrowUp');}});
    menu.addEventListener('keydown',event=>{
      const options=[...menu.querySelectorAll('button:not(:disabled)')],index=options.indexOf(document.activeElement);
      if(event.key==='Escape'){event.preventDefault();close(true);}
      else if(event.key==='Tab')close(true);
      else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();options[event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();}
    });
    select.addEventListener('change',sync);
    new MutationObserver(()=>{sync();if(!menu.hidden)close();}).observe(select,{childList:true,subtree:true,attributes:true});
    sync();return {sync,close};
  }
  document.addEventListener('pointerdown',event=>{if(active&&!active.host.contains(event.target)&&!active.menu.contains(event.target))active.close();});
  addEventListener('resize',()=>active?.close());
  addEventListener('scroll',event=>{if(active&&!active.menu.contains(event.target))active.close();},true);
  window.CompactSelect={attach};
})();
