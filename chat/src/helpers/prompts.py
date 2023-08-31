# ruff: noqa: E501
def prompt_template(): 
  return """Using all of the provided source documents, create a helpful and thorough answer to the supplied question.
  If you don't know the answer, just say that you don't know. Don't try to make up an answer, but you should use the documents provided in order to ground your response.
  It may be helpful to explain why a provided document does not pertain to the query as well.
  Feel free to reference various aspects of the sources in your explanation, but please don't include the full sources in the answer.
  The Content field represents the title of each document, and the Metadata fields are the attributes. The Source field is the unique identifier for each document.
  'certainty' is an opinionated measure of the distance between the query vector and the document embedding vector. Certainty always returns a number between 0 and 1, with 1 indicating identical vectors and 0 indicating opposing angles.

    Content: Purchase order and note
    Metadata:
      _additional: {{'certainty': 0.8744078576564789, 'id': '29389b8d-a85d-46d1-9a6d-a738c6f81c88'}}
      alternate_title: None
      collection: Berkeley Folk Music Festival
      contributor: ['University of California, Berkeley. Associated Students', 'Berkeley Folk Music Festival']
      creator: None
      date_created: ['October 7, 1970', '1970?']
      description: ['Purchase order for costs related to security for the 1970 Berkeley Folk Music Festival and a handwritten note containing calculations and the heading "Police"']
      genre: ['notes (documents)', 'purchase orders']
      language: ['English']
      library_unit: Charles Deering McCormick Library of Special Collections
      location: None
      physical_description_material: None
      physical_description_size: ['5 inches (height) x 3 inches (width)', '7 inches (height) x 8.5 inches (width)']
      published: True
      rights_statement: In Copyright
      scope_and_contents: None
      series: ['Berkeley Folk Music Festival Archive--3. Festivals: Records, Budgets, Publicity']
      source: 29389b8d-a85d-46d1-9a6d-a738c6f81c88
      style_period: None
      subject: ['Berkeley Folk Music Festival (15th : 1970 : Berkeley, Calif.)']
      table_of_contents: None
      technique: None
      visibility: Public
      work_type: Image
    Source: 29389b8d-a85d-46d1-9a6d-a738c6f81c88
    
    Content: Berkeley Folk Music Festival, 1966 June 26-30
    Metadata:
      _additional: {{'certainty': 0.869585394859314, 'id': '477e3f63-fc06-4bfc-8734-0b6100c0d1c3'}}
      alternate_title: None
      collection: Berkeley Folk Music Festival
      contributor: ['Olivier, Barry, 1935-', 'Hart, Kelly, 1943-', 'University of California, Berkeley. Associated Students']
      creator: None
      date_created: ['1966']
      description: ['Poster for the Berkeley Folk Music Festival, held at the University of California, Berkeley from June 30 to July 4, 1966, presented by the Associated Students. White text on black background between black and white images of a man playing a fiddle and another man singing into a mic while holding a guitar. Guest list includes Pete Seeger, Jefferson Airplane, Sam Hinton, Greenbriar Boys, Shlomo Carlebach, John Fahey, Los Halcones de Salitrillos, Charley Marshall, Phil Ochs, Ralph J. Gleason, Malvina Reynolds, Robert Pete Williams, Alice Stuart Thomas, Bess Lomax Hawes, and Charles Seeger.']
      genre: ['posters']
      language: ['English']
      library_unit: Charles Deering McCormick Library of Special Collections
      location: None
      physical_description_material: None
      physical_description_size: ['12.75 inches (height) x 12.75 inches (width)']
      published: True
      rights_statement: In Copyright
      scope_and_contents: None
      series: ['Berkeley Folk Music Festival Archive--13. Miscellaneous Posters']
      source: 477e3f63-fc06-4bfc-8734-0b6100c0d1c3
      style_period: None
      subject: ['Berkeley (Calif.)', 'University of California, Berkeley', 'Gleason, Ralph J.', 'Folk music', 'Jefferson Airplane (Musical group)', 'Seeger, Pete, 1919-2014', 'Fahey, John, 1939-2001', 'Williams, Robert Pete, 1914-1980', 'Folk music festivals', 'Hinton, Sam, 1917-2009', 'Reynolds, Malvina', 'Halcones de Salitrillo (Musical group)', 'Folk musicians', 'Concerts', 'Carlebach, Shlomo, 1925-1994', 'Marshall, Charley', 'Ochs, Phil', 'Seeger, Charles, 1886-1979', 'Berkeley Folk Music Festival', 'Greenbriar Boys', 'Stuart, Alice, 1942-', 'Hawes, Bess Lomax, 1921-2009']
      table_of_contents: None
      technique: None
      visibility: Public
      work_type: Image
    Source: 477e3f63-fc06-4bfc-8734-0b6100c0d1c3

    Content: Berkeley Folk Music Festival, 1966 June 26-30
    Metadata:
      _additional: {{'certainty': 0.8694239258766174, 'id': 'bddeb375-762b-45e3-9e4e-5a4084ac5955'}}
      alternate_title: None
      collection: Berkeley Folk Music Festival
      contributor: ['Olivier, Barry, 1935-', 'Hart, Kelly, 1943-', 'University of California, Berkeley. Associated Students']
      creator: None
      date_created: ['1966']
      description: ['Poster for the Berkeley Folk Music Festival, held at the University of California, Berkeley from June 30 to July 4, 1966, presented by the Associated Students. White text on black background between black and white images of a man playing a fiddle and another man singing into a mic while holding a guitar. Guest list includes Pete Seeger, Jefferson Airplane, Sam Hinton, Greenbriar Boys, Shlomo Carlebach, John Fahey, Los Halcones de Salitrillos, Charley Marshall, Phil Ochs, Ralph J. Gleason, Malvina Reynolds, Robert Pete Williams, Alice Stuart Thomas, Bess Lomax Hawes, and Charles Seeger.']
      genre: ['posters']
      language: ['English']
      library_unit: Charles Deering McCormick Library of Special Collections
      location: None
      physical_description_material: None
      physical_description_size: ['13.75 inches (height) x 21.75 inches (width)']
      published: True
      rights_statement: In Copyright
      scope_and_contents: None
      series: ['Berkeley Folk Music Festival Archive--9. Posters of Berkeley Folk Music Festivals']
      source: bddeb375-762b-45e3-9e4e-5a4084ac5955
      style_period: None
      subject: ['Berkeley (Calif.)', 'University of California, Berkeley', 'Gleason, Ralph J.', 'Folk music', 'Jefferson Airplane (Musical group)', 'Seeger, Pete, 1919-2014', 'Fahey, John, 1939-2001', 'Williams, Robert Pete, 1914-1980', 'Folk music festivals', 'Hinton, Sam, 1917-2009', 'Reynolds, Malvina', 'Halcones de Salitrillo (Musical group)', 'Folk musicians', 'Concerts', 'Carlebach, Shlomo, 1925-1994', 'Marshall, Charley', 'Ochs, Phil', 'Berkeley Folk Music Festival (9th : 1966 : Berkeley, Calif.)', 'Hawes, Bess Lomax, 1921-2009', 'Greenbriar Boys', 'Stuart, Alice, 1942-', 'Seeger, Charles, 1886-1979', 'Berkeley Folk Music Festival']
      table_of_contents: None
      technique: None
      visibility: Public
      work_type: Image
    Source: bddeb375-762b-45e3-9e4e-5a4084ac5955

    Content: Berkeley Folk Music Festival, 1966 June 30-July 4
    Metadata:
      _additional: {{'certainty': 0.8693937957286835, 'id': 'aab0bb76-ab02-429a-843a-5be56e31ba67'}}
      alternate_title: None
      collection: Berkeley Folk Music Festival
      contributor: ['Olivier, Barry, 1935-', 'Hart, Kelly, 1943-', 'University of California, Berkeley. Associated Students']
      creator: None
      date_created: ['1966']
      description: ['Poster for the 9th Annual Berkeley Folk Music Festival, held at the University of California, Berkeley from June 30 to July 4, 1966, presented by the Associated Students. White text on black background between black and white images of a man playing a fiddle and another man singing into a mic while holding a guitar. Guest list includes Pete Seeger, Jefferson Airplane, Sam Hinton, Greenbriar Boys, Shlomo Carlebach, John Fahey, Los Halcones de Salitrillos, Charley Marshall, Phil Ochs, Ralph J. Gleason, Malvina Reynolds, Robert Pete Williams, Alice Stuart Thomas, Bess Lomax Hawes, and Charles Seeger. Originally found in box 28, folder 3.']
      genre: ['posters']
      language: ['English']
      library_unit: Charles Deering McCormick Library of Special Collections
      location: None
      physical_description_material: None
      physical_description_size: ['24.25 inches (height) x 37.5 inches (width)']
      published: True
      rights_statement: In Copyright
      scope_and_contents: None
      series: ['Berkeley Folk Music Festival Archive--13. Miscellaneous Posters']
      source: aab0bb76-ab02-429a-843a-5be56e31ba67
      style_period: None
      subject: ['Berkeley (Calif.)', 'University of California, Berkeley', 'Gleason, Ralph J.', 'Folk music', 'Jefferson Airplane (Musical group)', 'Seeger, Pete, 1919-2014', 'Fahey, John, 1939-2001', 'Williams, Robert Pete, 1914-1980', 'Folk music festivals', 'Hinton, Sam, 1917-2009', 'Reynolds, Malvina', 'Halcones de Salitrillo (Musical group)', 'Folk musicians', 'Concerts', 'Carlebach, Shlomo, 1925-1994', 'Marshall, Charley', 'Ochs, Phil', 'Berkeley Folk Music Festival (9th : 1966 : Berkeley, Calif.)', 'Hawes, Bess Lomax, 1921-2009', 'Greenbriar Boys', 'Stuart, Alice, 1942-', 'Seeger, Charles, 1886-1979', 'Berkeley Folk Music Festival']
      table_of_contents: None
      technique: None
      visibility: Public
      work_type: Image
    Source: aab0bb76-ab02-429a-843a-5be56e31ba67

    QUESTION: Which musicians played at the Berkeley Folk Music Festival?
    HELPFUL ANSWER: For the 1966 Berkeley Folk Music Festival, held at the University of California, Berkeley from June 30 to July 4, the following musicians and groups were listed as performers:

    Pete Seeger
    Jefferson Airplane
    Sam Hinton
    Greenbriar Boys
    Shlomo Carlebach
    John Fahey
    Los Halcones de Salitrillos
    Charley Marshall
    Phil Ochs
    Ralph J. Gleason
    Malvina Reynolds
    Robert Pete Williams
    Alice Stuart Thomas
    Bess Lomax Hawes
    Charles Seeger

    Unfortunately, the documents provided do not include information about musicians who performed at the Berkeley Folk Music Festival in other years during the 1960s or 1970s. Therefore, I can only confirm the musicians for the 1966 festival.

    {context}

    QUESTION: {question}  
    =========
    HELPFUL ANSWER:"""

def document_template(attributes):
  lines = (["Content: {page_content}", "Metadata:"] +
            [f"  {attribute}: {{{attribute}}}" for attribute in attributes] +
            ["Source: {source}"])
  return "\n".join(lines)
