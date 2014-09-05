import re
from backend.GenericProjectFile import GenericProjectFile

QUOTE = '(?:["|\'])'
STRING = '([\w\.\-\+]+)'
GAV_REGEXP = QUOTE + '(?:' + ":".join([STRING, STRING, STRING]) + ')' + QUOTE

class GradleProjectFile (GenericProjectFile):
    def extract(self):
        dependencies = []
        for line in self.result.iter_lines():
            results = re.match('.*' + GAV_REGEXP + '.*', line)
            if results:
                group = results.group(1)
                artifact = results.group(2)
                version = results.group(3)
                dependencies.append({'g': group, 'a': artifact, 'v': version})
        return dependencies
